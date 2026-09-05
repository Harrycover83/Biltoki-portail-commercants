import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import type { PennylaneClient } from '../integrations/pennylane/client.js'
import type { PennylaneServiceCharge } from '../integrations/pennylane/types.js'

export type SyncResult = {
  syncId: string
  hallId: string
  status: 'running' | 'success' | 'error'
  startedAt: string
  completedAt?: string
  recordsProcessed: number
  errors: string[]
}

type DbServiceCharge = {
  id: string
  label: string
  amount_excl_tax: number
  amount_tax: number
  amount_incl_tax: number
  pennylane_id: string
}

type DbPeriod = {
  id: string
  label: string
  period_start: string
  period_end: string
}

/** How many trailing calendar months (including the current one) the nightly sync re-checks. */
const RECENT_MONTHS_WINDOW = 3

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const details = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const message = typeof details.message === 'string' ? details.message : JSON.stringify(error)
    const context = [details.details, details.hint, details.code]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' | ')
    return context ? `${message} (${context})` : message
  }

  return String(error)
}

export class PennylaneSync {
  private readonly db: SupabaseAdmin
  private readonly pennylane: PennylaneClient
  private readonly logger: Logger
  private readonly hallId: string

  constructor(db: SupabaseAdmin, pennylane: PennylaneClient, hallId: string, logger: Logger) {
    this.db = db
    this.pennylane = pennylane
    this.hallId = hallId
    this.logger = logger
  }

  /** Nightly/manual sync: re-checks the current month plus the last few, to catch late corrections. */
  async syncServiceCharges(): Promise<SyncResult> {
    const syncId = this.generateSyncId()
    const startedAt = new Date().toISOString()

    this.logger.info(`Starting Pennylane sync for hall ${this.hallId}: ${syncId}`)

    try {
      await this.createSyncRecord(syncId, 'running', startedAt)

      const months = this.lastNMonths(RECENT_MONTHS_WINDOW)
      let recordsProcessed = 0
      const errors: string[] = []

      for (const month of months) {
        try {
          recordsProcessed += await this.syncMonth(month)
        } catch (err) {
          const msg = `Failed to sync month ${month.toISOString().slice(0, 7)}: ${getErrorMessage(err)}`
          this.logger.error(msg)
          errors.push(msg)
        }
      }

      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: errors.length > 0 ? 'error' : 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed,
        errors,
      }

      await this.updateSyncRecord(syncId, result.status, result, errors.join('; ') || undefined)
      this.logger.info(`✅ Sync completed: ${recordsProcessed} charges imported/updated`)

      return result
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      this.logger.error(`❌ Sync failed: ${errorMsg}`)

      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: 'error',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed: 0,
        errors: [errorMsg],
      }

      await this.updateSyncRecord(syncId, 'error', result, errorMsg)
      return result
    }
  }

  /** One-off full historical import: fetches every invoice ever categorized for this hall. */
  async backfillHistory(): Promise<SyncResult> {
    const syncId = this.generateSyncId()
    const startedAt = new Date().toISOString()

    this.logger.info(`Starting Pennylane FULL HISTORY backfill for hall ${this.hallId}: ${syncId}`)

    try {
      await this.createSyncRecord(syncId, 'running', startedAt)

      const pennylaneCharges = await this.pennylane.fetchServiceCharges(this.hallId)

      const byMonth = new Map<string, PennylaneServiceCharge[]>()
      for (const charge of pennylaneCharges.charges) {
        const monthKey = (charge.date ?? charge.createdAt ?? startedAt).slice(0, 7) // YYYY-MM
        if (!byMonth.has(monthKey)) {
          byMonth.set(monthKey, [])
        }
        byMonth.get(monthKey)!.push(charge)
      }

      let recordsProcessed = 0
      const errors: string[] = []

      for (const [monthKey, monthCharges] of [...byMonth.entries()].sort()) {
        try {
          const [year, month] = monthKey.split('-').map(Number)
          const monthStart = new Date(Date.UTC(year, month - 1, 1))
          const period = await this.resolveMonthPeriod(monthStart)
          for (const charge of monthCharges) {
            await this.upsertServiceCharge(period.id, charge)
            recordsProcessed += 1
          }
        } catch (err) {
          const msg = `Failed to backfill month ${monthKey}: ${getErrorMessage(err)}`
          this.logger.error(msg)
          errors.push(msg)
        }
      }

      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: errors.length > 0 ? 'error' : 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed,
        errors,
      }

      await this.updateSyncRecord(syncId, result.status, result, errors.join('; ') || undefined)
      this.logger.info(
        `✅ Backfill completed: ${recordsProcessed} charges imported/updated across ${byMonth.size} month(s)`,
      )

      return result
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      this.logger.error(`❌ Backfill failed: ${errorMsg}`)

      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: 'error',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed: 0,
        errors: [errorMsg],
      }

      await this.updateSyncRecord(syncId, 'error', result, errorMsg)
      return result
    }
  }

  /** Fetches + upserts a single calendar month, creating its period if needed. Returns charges processed. */
  private async syncMonth(monthStart: Date): Promise<number> {
    const period = await this.resolveMonthPeriod(monthStart)

    const pennylaneCharges = await this.pennylane.fetchServiceCharges(this.hallId, {
      from: period.period_start,
      to: period.period_end,
    })

    for (const charge of pennylaneCharges.charges) {
      await this.upsertServiceCharge(period.id, charge)
    }

    return pennylaneCharges.charges.length
  }

  private lastNMonths(count: number): Date[] {
    const now = new Date()
    const months: Date[] = []
    for (let i = 0; i < count; i++) {
      months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)))
    }
    return months
  }

  /** Finds a period covering the whole calendar month, or creates one labeled "YYYY-MM". */
  private async resolveMonthPeriod(monthStart: Date): Promise<DbPeriod> {
    const start = monthStart.toISOString().slice(0, 10)
    const end = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)

    const { data: existing, error: selectError } = await this.db
      .from('service_charge_periods')
      .select('id, label, period_start, period_end')
      .eq('hall_id', this.hallId)
      .lte('period_start', start)
      .gte('period_end', end)
      .maybeSingle()

    if (selectError) {
      throw selectError
    }
    if (existing) {
      return existing as DbPeriod
    }

    const label = start.slice(0, 7) // YYYY-MM
    const { data: created, error: insertError } = await this.db
      .from('service_charge_periods')
      .insert({
        hall_id: this.hallId,
        label,
        period_start: start,
        period_end: end,
        status: 'draft',
      })
      .select('id, label, period_start, period_end')
      .single()

    if (insertError) {
      throw insertError
    }

    return created as DbPeriod
  }

  private async upsertServiceCharge(
    periodId: string,
    pennylaneCharge: PennylaneServiceCharge,
  ): Promise<DbServiceCharge> {
    // Try to find existing charge
    const { data: existing, error: selectError } = await this.db
      .from('service_charges')
      .select('id')
      .eq('hall_id', this.hallId)
      .eq('pennylane_id', pennylaneCharge.id)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError
    }

    if (existing) {
      // Update existing
      const { error: updateError } = await this.db
        .from('service_charges')
        .update({
          label: pennylaneCharge.label,
          amount_excl_tax: pennylaneCharge.amountExclTax,
          amount_tax: pennylaneCharge.taxAmount,
          amount_incl_tax: pennylaneCharge.amountInclTax,
          category: pennylaneCharge.categoryLabel || null,
          invoice_date: pennylaneCharge.date || null,
        })
        .eq('id', existing.id)

      if (updateError) throw updateError

      return {
        id: existing.id,
        label: pennylaneCharge.label,
        amount_excl_tax: pennylaneCharge.amountExclTax,
        amount_tax: pennylaneCharge.taxAmount,
        amount_incl_tax: pennylaneCharge.amountInclTax,
        pennylane_id: pennylaneCharge.id,
      }
    }

    // Create new
    const { data: created, error: insertError } = await this.db
      .from('service_charges')
      .insert({
        hall_id: this.hallId,
        period_id: periodId,
        label: pennylaneCharge.label,
        category: pennylaneCharge.categoryLabel || null,
        amount_excl_tax: pennylaneCharge.amountExclTax,
        amount_tax: pennylaneCharge.taxAmount,
        amount_incl_tax: pennylaneCharge.amountInclTax,
        pennylane_id: pennylaneCharge.id,
        invoice_date: pennylaneCharge.date || null,
        source: 'pennylane',
      })
      .select('id, label, amount_excl_tax, amount_tax, amount_incl_tax, pennylane_id')
      .single()

    if (insertError) throw insertError

    return created as DbServiceCharge
  }

  private async createSyncRecord(syncId: string, status: string, startedAt: string) {
    const { error } = await this.db.from('pennylane_syncs').insert({
      id: syncId,
      hall_id: this.hallId,
      sync_type: 'service_charges',
      status: status as any,
      started_at: startedAt,
      records_processed: 0,
    })

    if (error) {
      this.logger.error(`Failed to create sync record: ${error.message}`)
      throw error
    }
  }

  private async updateSyncRecord(syncId: string, status: string, result: SyncResult, errorMsg?: string) {
    const { error } = await this.db
      .from('pennylane_syncs')
      .update({
        status: status as any,
        completed_at: result.completedAt,
        records_processed: result.recordsProcessed,
        error_message: errorMsg || null,
      })
      .eq('id', syncId)

    if (error) {
      this.logger.error(`Failed to update sync record: ${error.message}`)
    }
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
