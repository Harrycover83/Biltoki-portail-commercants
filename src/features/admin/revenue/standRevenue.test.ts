import { describe, expect, it } from 'vitest'
import { buildStandRevenue, type Declaration, type StandMerchant } from './standRevenue'

const merchant = (id: string, name: string, overrides: Partial<StandMerchant> = {}): StandMerchant => ({
  id, legal_name: `${name} SAS`, trade_name: name, active: true, stands: [{ name: `Stand ${name}`, number: null, active: true }], ...overrides,
})
const declaration = (merchantId: string, month: string, cents: number, updatedAt = '2026-10-02T09:00:00Z'): Declaration => ({
  merchant_id: merchantId, month: `${month}-01`, amount_cents: cents, updated_at: updatedAt,
})

describe('buildStandRevenue', () => {
  const merchants = [merchant('b', 'Balme'), merchant('a', 'All Angus', { stands: [{ name: 'A1', number: '12', active: true }, { name: 'old', number: null, active: false }] })]

  it('lists every stand with its latest declared month, never inventing a missing one', () => {
    const { rows } = buildStandRevenue(merchants, [
      declaration('a', '2026-08', 100_000), declaration('a', '2026-09', 125_000, '2026-10-05T10:00:00Z'),
    ], (month) => month)

    expect(rows.map((row) => row.name)).toEqual(['All Angus', 'Balme'])
    expect(rows[0]).toMatchObject({ stands: 'A1 (n° 12)', lastMonth: '2026-09', lastCents: 125_000, trendPercent: 25, declaredAt: '2026-10-05T10:00:00Z' })
    expect(rows[1]).toMatchObject({ lastMonth: null, lastCents: null, trendPercent: null, declaredAt: null })
  })

  it('has no trend when the month before was not declared or was zero', () => {
    const gap = buildStandRevenue(merchants, [declaration('a', '2026-06', 100), declaration('a', '2026-09', 200)], (m) => m)
    expect(gap.rows[0].trendPercent).toBeNull()
    const zero = buildStandRevenue(merchants, [declaration('a', '2026-08', 0), declaration('a', '2026-09', 200)], (m) => m)
    expect(zero.rows[0].trendPercent).toBeNull()
  })

  it('computes the trend across a year boundary', () => {
    const { rows } = buildStandRevenue(merchants, [declaration('a', '2025-12', 1000), declaration('a', '2026-01', 1500)], (m) => m)
    expect(rows[0].trendPercent).toBe(50)
  })

  it('draws one curve per stand that declared, over the whole history', () => {
    const { chart } = buildStandRevenue(merchants, [
      declaration('a', '2026-08', 100_000), declaration('b', '2026-09', 50_000),
    ], (month) => `m${month}`)

    expect(chart.names).toEqual(['All Angus', 'Balme'])
    expect(chart.months).toEqual([
      { month: 'm2026-08', 'All Angus': 1000, Balme: null },
      { month: 'm2026-09', 'All Angus': null, Balme: 500 },
    ])
  })

  it('has an empty chart when nobody declared, and hides inactive merchants without declarations', () => {
    const none = buildStandRevenue([...merchants, merchant('c', 'Closed', { active: false })], [], (m) => m)
    expect(none.chart).toEqual({ names: [], months: [] })
    expect(none.rows.map((row) => row.name)).toEqual(['All Angus', 'Balme'])
  })
})
