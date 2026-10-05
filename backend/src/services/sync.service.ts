import { randomUUID } from 'node:crypto'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import type { PennylaneClient } from '../integrations/pennylane/client.js'
import type { PennylaneServiceCharge } from '../integrations/pennylane/types.js'

type SyncStatus = 'running' | 'success' | 'error'

export type SyncResult = {
  syncId: string
  hallId: string
  status: SyncStatus
  startedAt: string
  completedAt?: string
  recordsProcessed: number
  errors: string[]
}

type SyncOutcome = {
  recordsProcessed: number
  errors: string[]
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
  constructor(
    private readonly db: SupabaseAdmin,
    private readonly pennylane: PennylaneClient,
    private readonly hallId: string,
    private readonly logger: Logger,
  ) {}

  /** Nightly/manual sync: re-checks the current month plus the last few, to catch late corrections. */
  syncServiceCharges(): Promise<SyncResult> {
    return this.run('sync', async () => {
      let recordsProcessed = 0
      const errors: string[] = []

      for (const month of this.lastNMonths(RECENT_MONTHS_WINDOW)) {
        try {
          recordsProcessed += await this.syncMonth(month)
        } catch (err) {
          errors.push(this.recordMonthFailure('sync', month.toISOString().slice(0, 7), err))
        }
      }

      return { recordsProcessed, errors }
    })
  }

  /** One-off full historical import: fetches every invoice ever categorized for this hall. */
  backfillHistory(): Promise<SyncResult> {
    return this.run('full history backfill', async (startedAt) => {
      const { charges } = await this.pennylane.fetchServiceCharges(this.hallId)

      const byMonth = new Map<string, PennylaneServiceCharge[]>()
      for (const charge of charges) {
        const monthKey = (charge.date ?? charge.createdAt ?? startedAt).slice(0, 7) // YYYY-MM
        byMonth.set(monthKey, [...(byMonth.get(monthKey) ?? []), charge])
      }

      let recordsProcessed = 0
      const errors: string[] = []

      for (const [monthKey, monthCharges] of [...byMonth.entries()].sort()) {
        try {
          const [year, month] = monthKey.split('-').map(Number)
          const period = await this.resolveMonthPeriod(new Date(Date.UTC(year, month - 1, 1)))
          for (const charge of monthCharges) {
            await this.upsertServiceCharge(period.id, charge)
            recordsProcessed += 1
          }
        } catch (err) {
          errors.push(this.recordMonthFailure('backfill', monthKey, err))
        }
      }

      return { recordsProcessed, errors }
    })
  }

  /** Wraps a sync job with its audit record (pennylane_syncs) and a uniform result. */
  private async run(label: string, work: (startedAt: string) => Promise<SyncOutcome>): Promise<SyncResult> {
    const syncId = randomUUID()
    const startedAt = new Date().toISOString()

    this.logger.info(`Starting Pennylane ${label} for hall ${this.hallId}: ${syncId}`)

    try {
      await this.createSyncRecord(syncId, startedAt)

      const { recordsProcessed, errors } = await work(startedAt)
      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: errors.length > 0 ? 'error' : 'success',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed,
        errors,
      }

      await this.updateSyncRecord(result, errors.join('; ') || undefined)
      this.logger.info(`Pennylane ${label} finished (${result.status}): ${recordsProcessed} charges imported/updated`)
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      this.logger.error(`Pennylane ${label} failed: ${message}`)

      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: 'error',
        startedAt,
        completedAt: new Date().toISOString(),
        recordsProcessed: 0,
        errors: [message],
      }

      await this.updateSyncRecord(result, message)
      return result
    }
  }

  private recordMonthFailure(label: string, monthKey: string, error: unknown): string {
    const message = `Failed to ${label} month ${monthKey}: ${getErrorMessage(error)}`
    this.logger.error(message)
    return message
  }

  /** Fetches + upserts a single calendar month, creating its period if needed. Returns charges processed. */
  private async syncMonth(monthStart: Date): Promise<number> {
    const period = await this.resolveMonthPeriod(monthStart)

    const { charges } = await this.pennylane.fetchServiceCharges(this.hallId, {
      from: period.period_start,
      to: period.period_end,
    })

    for (const charge of charges) {
      await this.upsertServiceCharge(period.id, charge)
    }

    return charges.length
  }

  private lastNMonths(count: number): Date[] {
    const now = new Date()
    return Array.from(
      { length: count },
      (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
    )
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

    const { data: created, error: insertError } = await this.db
      .from('service_charge_periods')
      .insert({
        hall_id: this.hallId,
        label: start.slice(0, 7), // YYYY-MM
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

  private async upsertServiceCharge(periodId: string, charge: PennylaneServiceCharge): Promise<void> {
    const { data: existing, error: selectError } = await this.db
      .from('service_charges')
      .select('id')
      .eq('hall_id', this.hallId)
      .eq('pennylane_id', charge.id)
      .maybeSingle()

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError
    }

    const fields = {
      label: charge.label,
      category: charge.categoryLabel || null,
      supplier_name: charge.supplierName || null,
      amount_excl_tax: charge.amountExclTax,
      amount_tax: charge.taxAmount,
      amount_incl_tax: charge.amountInclTax,
      invoice_date: charge.date || null,
    }

    if (existing) {
      const { error } = await this.db.from('service_charges').update(fields).eq('id', existing.id)
      if (error) throw error
      return
    }

    const { error } = await this.db.from('service_charges').insert({
      ...fields,
      hall_id: this.hallId,
      period_id: periodId,
      pennylane_id: charge.id,
      source: 'pennylane',
    })
    if (error) throw error
  }

  private async createSyncRecord(syncId: string, startedAt: string): Promise<void> {
    const { error } = await this.db.from('pennylane_syncs').insert({
      id: syncId,
      hall_id: this.hallId,
      sync_type: 'service_charges',
      status: 'running' satisfies SyncStatus,
      started_at: startedAt,
      records_processed: 0,
    })

    if (error) {
      this.logger.error(`Failed to create sync record: ${error.message}`)
      throw error
    }
  }

  private async updateSyncRecord(result: SyncResult, errorMessage?: string): Promise<void> {
    const { error } = await this.db
      .from('pennylane_syncs')
      .update({
        status: result.status,
        completed_at: result.completedAt,
        records_processed: result.recordsProcessed,
        error_message: errorMessage ?? null,
      })
      .eq('id', result.syncId)

    if (error) {
      this.logger.error(`Failed to update sync record: ${error.message}`)
    }
  }
}
