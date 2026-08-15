import type { SupabaseAdmin } from '../db/supabase'
import type { Logger } from '../utils/logger'
import type { PennylaneClient } from '../integrations/pennylane/client'

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
  period_start: string
  period_end: string
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

  async syncServiceCharges(): Promise<SyncResult> {
    const syncId = this.generateSyncId()
    const startedAt = new Date().toISOString()

    this.logger.info(`Starting Pennylane sync for hall ${this.hallId}: ${syncId}`)

    try {
      // 1. Create sync record
      await this.createSyncRecord(syncId, 'running', startedAt)

      // 2. Fetch from Pennylane
      this.logger.info('Fetching service charges from Pennylane...')
      const pennylaneCharges = await this.pennylane.fetchServiceCharges(this.hallId)

      if (pennylaneCharges.charges.length === 0) {
        this.logger.warn('No charges returned from Pennylane')
        const result: SyncResult = {
          syncId,
          hallId: this.hallId,
          status: 'success',
          startedAt,
          completedAt: new Date().toISOString(),
          recordsProcessed: 0,
          errors: [],
        }
        await this.updateSyncRecord(syncId, 'success', result)
        return result
      }

      // 3. Get current period
      const period = await this.getCurrentPeriod()
      if (!period) {
        throw new Error('No active service charge period found')
      }

      // 4. Upsert charges only (no allocation calculation)
      this.logger.info(`Upserting ${pennylaneCharges.charges.length} charges...`)
      const upsertedCharges: DbServiceCharge[] = []

      for (const pennylaneCharge of pennylaneCharges.charges) {
        try {
          const charge = await this.upsertServiceCharge(period.id, pennylaneCharge)
          upsertedCharges.push(charge)
        } catch (err) {
          const msg = `Failed to upsert charge ${pennylaneCharge.id}: ${err}`
          this.logger.error(msg)
        }
      }

      // 5. Mark sync as complete
      const completedAt = new Date().toISOString()
      const result: SyncResult = {
        syncId,
        hallId: this.hallId,
        status: 'success',
        startedAt,
        completedAt,
        recordsProcessed: upsertedCharges.length,
        errors: [],
      }

      await this.updateSyncRecord(syncId, 'success', result)

      this.logger.info(
        `✅ Sync completed: ${upsertedCharges.length} charges imported`,
      )

      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
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

  private async getCurrentPeriod(): Promise<DbPeriod | null> {
    const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const { data, error } = await this.db
      .from('service_charge_periods')
      .select('id, period_start, period_end')
      .eq('hall_id', this.hallId)
      .lte('period_start', now)
      .gte('period_end', now)
      .single()

    if (error) {
      this.logger.warn(`No period found for today: ${error.message}`)
      return null
    }

    return data as DbPeriod
  }

  private async upsertServiceCharge(
    periodId: string,
    pennylaneCharge: any,
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
