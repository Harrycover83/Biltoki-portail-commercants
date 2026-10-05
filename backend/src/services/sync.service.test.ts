import { describe, expect, it, vi } from 'vitest'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { PennylaneClient } from '../integrations/pennylane/client.js'
import type { PennylaneServiceCharge } from '../integrations/pennylane/types.js'
import type { Logger } from '../utils/logger.js'
import { PennylaneSync } from './sync.service.js'

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string; code?: string } | null }

/** Minimal in-memory stand-in for the Supabase query builder used by the sync service. */
class FakeDb {
  tables: Record<string, Row[]> = { service_charge_periods: [], service_charges: [], pennylane_syncs: [] }
  failInsertOn: string | null = null
  private nextId = 1

  from(table: string) {
    const rows = this.tables[table]
    const filters: ((row: Row) => boolean)[] = []
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}

    const matching = () => rows.filter((row) => filters.every((filter) => filter(row)))

    const run = (): Result => {
      if (mode === 'insert') {
        if (this.failInsertOn === table) {
          return { data: null, error: { message: `insert into ${table} failed` } }
        }
        const row = { id: `id-${this.nextId++}`, ...payload }
        rows.push(row)
        return { data: row, error: null }
      }
      if (mode === 'update') {
        matching().forEach((row) => Object.assign(row, payload))
        return { data: null, error: null }
      }
      return { data: matching(), error: null }
    }

    const builder = {
      select: () => builder,
      insert: (value: Row) => {
        mode = 'insert'
        payload = value
        return builder
      },
      update: (value: Row) => {
        mode = 'update'
        payload = value
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value)
        return builder
      },
      lte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) <= value)
        return builder
      },
      gte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) >= value)
        return builder
      },
      maybeSingle: async (): Promise<Result> => {
        const result = run()
        return { ...result, data: (result.data as Row[])[0] ?? null }
      },
      single: async (): Promise<Result> => run(),
      then: (resolve: (value: Result) => unknown) => Promise.resolve(run()).then(resolve),
    }
    return builder
  }
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

function charge(id: string, date: string, overrides: Partial<PennylaneServiceCharge> = {}): PennylaneServiceCharge {
  return {
    id,
    label: `Facture ${id}`,
    categoryLabel: '4105',
    supplierName: 'Fournisseur',
    amountExclTax: 100,
    taxAmount: 20,
    amountInclTax: 120,
    date,
    createdAt: `${date}T08:00:00Z`,
    ...overrides,
  }
}

function setup(charges: PennylaneServiceCharge[]) {
  const db = new FakeDb()
  const fetchServiceCharges = vi.fn(async () => ({ charges, totalCount: charges.length, hasMore: false }))
  const pennylane = { fetchServiceCharges } as unknown as PennylaneClient
  const sync = new PennylaneSync(db as unknown as SupabaseAdmin, pennylane, 'hall-1', logger)
  return { db, fetchServiceCharges, sync }
}

describe('PennylaneSync.syncServiceCharges', () => {
  it('imports charges, creates the month periods and records a successful run', async () => {
    const { db, sync, fetchServiceCharges } = setup([charge('1', '2026-10-02'), charge('2', '2026-10-03')])

    const result = await sync.syncServiceCharges()

    expect(result.status).toBe('success')
    expect(fetchServiceCharges).toHaveBeenCalledTimes(3) // current month + the two before
    expect(db.tables.service_charge_periods).toHaveLength(3)
    expect(db.tables.service_charges.filter((row) => row.pennylane_id === '1')).toHaveLength(1)
    expect(db.tables.service_charges[0]).toMatchObject({ hall_id: 'hall-1', source: 'pennylane', amount_incl_tax: 120 })
    expect(db.tables.pennylane_syncs[0]).toMatchObject({ hall_id: 'hall-1', status: 'success' })
  })

  it('is idempotent: a second run updates existing charges instead of duplicating them', async () => {
    const { db, sync } = setup([charge('1', '2026-10-02')])

    await sync.syncServiceCharges()
    const afterFirst = db.tables.service_charges.length
    await sync.syncServiceCharges()

    expect(db.tables.service_charges).toHaveLength(afterFirst)
    expect(db.tables.pennylane_syncs).toHaveLength(2)
  })

  it('reports a failing month as an error without losing the other months', async () => {
    const { db, sync, fetchServiceCharges } = setup([charge('1', '2026-10-02')])
    fetchServiceCharges.mockRejectedValueOnce(new Error('Pennylane 500'))

    const result = await sync.syncServiceCharges()

    expect(result.status).toBe('error')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Pennylane 500')
    expect(result.recordsProcessed).toBe(2)
    expect(db.tables.pennylane_syncs[0]).toMatchObject({ status: 'error' })
  })

  it('returns an error result when the audit record cannot be created', async () => {
    const { db, sync } = setup([])
    db.failInsertOn = 'pennylane_syncs'

    const result = await sync.syncServiceCharges()

    expect(result.status).toBe('error')
    expect(result.recordsProcessed).toBe(0)
  })
})

describe('PennylaneSync.backfillHistory', () => {
  it('groups the full history by month and reuses one period per month', async () => {
    const { db, sync } = setup([
      charge('1', '2026-01-10'),
      charge('2', '2026-01-25'),
      charge('3', '2026-03-05'),
    ])

    const result = await sync.backfillHistory()

    expect(result).toMatchObject({ status: 'success', recordsProcessed: 3 })
    expect(db.tables.service_charge_periods.map((row) => row.label).sort()).toEqual(['2026-01', '2026-03'])
    expect(db.tables.service_charges).toHaveLength(3)
  })
})
