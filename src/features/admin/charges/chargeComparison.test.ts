import { describe, expect, it } from 'vitest'
import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import {
  buildSupplierHistory,
  comparePeriods,
  formatPeriodKey,
  listPeriodKeys,
  listSuppliers,
  shiftPeriodKey,
  UNKNOWN_SUPPLIER,
} from './chargeComparison'

function row(id: string, supplier: string | null, amount: number, date: string, category: string | null = null): AdminChargeRow {
  return {
    id,
    label: `Facture ${id}`,
    category,
    supplier_name: supplier,
    amount_incl_tax: amount,
    pennylane_id: null,
    invoice_date: date,
    period_end: date,
    created_at: `${date}T00:00:00Z`,
  }
}

const rows = [
  row('1', 'Veolia', 100, '2025-08-10', 'Eau'),
  row('2', 'Veolia', 150, '2026-08-05', 'Eau'),
  row('3', 'Engie', 300, '2025-08-20', 'Énergie'),
  row('4', 'Engie', 200, '2026-08-21', 'Énergie'),
  row('5', 'Nettoyage Pro', 80, '2026-08-30'),
  row('6', null, 19.99, '2026-01-15'),
  row('7', 'Veolia', 120, '2026-09-02', 'Eau'),
]

describe('shiftPeriodKey', () => {
  it('moves months across year boundaries', () => {
    expect(shiftPeriodKey('2026-08', 'month', -12)).toBe('2025-08')
    expect(shiftPeriodKey('2026-01', 'month', -1)).toBe('2025-12')
    expect(shiftPeriodKey('2025-12', 'month', 1)).toBe('2026-01')
  })

  it('moves years', () => {
    expect(shiftPeriodKey('2026', 'year', -1)).toBe('2025')
  })
})

describe('listPeriodKeys', () => {
  it('lists every period between the oldest and newest invoice, newest first', () => {
    const keys = listPeriodKeys(rows, 'month')
    expect(keys[0]).toBe('2026-09')
    expect(keys.at(-1)).toBe('2025-08')
    expect(keys).toHaveLength(14)
    expect(keys).toContain('2026-03')
  })

  it('lists years and handles no data', () => {
    expect(listPeriodKeys(rows, 'year')).toEqual(['2026', '2025'])
    expect(listPeriodKeys([], 'month')).toEqual([])
  })
})

describe('formatPeriodKey', () => {
  it('formats months and years', () => {
    expect(formatPeriodKey('2026-08')).toBe('août 2026')
    expect(formatPeriodKey('2026')).toBe('2026')
  })
})

describe('comparePeriods', () => {
  const result = comparePeriods(rows, {
    granularity: 'month',
    groupBy: 'supplier',
    current: '2026-08',
    reference: '2025-08',
  })

  it('totals both periods and the change', () => {
    expect(result.currentCents).toBe(43000)
    expect(result.referenceCents).toBe(40000)
    expect(result.deltaCents).toBe(3000)
    expect(result.deltaPct).toBeCloseTo(7.5)
    expect(result.currentCount).toBe(3)
    expect(result.referenceCount).toBe(2)
  })

  it('ranks suppliers by absolute change and flags new ones without a percentage', () => {
    expect(result.lines.map((line) => [line.name, line.deltaCents])).toEqual([
      ['Engie', -10000],
      ['Nettoyage Pro', 8000],
      ['Veolia', 5000],
    ])
    const nouveau = result.lines.find((line) => line.name === 'Nettoyage Pro')
    expect(nouveau?.deltaPct).toBeNull()
    expect(nouveau?.referenceCents).toBe(0)
  })

  it('groups by category', () => {
    const byCategory = comparePeriods(rows, {
      granularity: 'month',
      groupBy: 'category',
      current: '2026-08',
      reference: '2025-08',
    })
    expect(byCategory.lines.map((line) => line.name).sort()).toEqual(['Eau', 'Sans catégorie', 'Énergie'])
  })

  it('compares years', () => {
    const years = comparePeriods(rows, { granularity: 'year', groupBy: 'supplier', current: '2026', reference: '2025' })
    expect(years.currentCents).toBe(15000 + 20000 + 8000 + 1999 + 12000)
    expect(years.referenceCents).toBe(40000)
  })

  it('returns zero totals and no percentage for an empty reference', () => {
    const empty = comparePeriods(rows, { granularity: 'month', groupBy: 'supplier', current: '2026-08', reference: '2024-01' })
    expect(empty.referenceCents).toBe(0)
    expect(empty.deltaPct).toBeNull()
  })

  it('counts a period compared with itself on both sides', () => {
    const same = comparePeriods(rows, { granularity: 'month', groupBy: 'supplier', current: '2026-08', reference: '2026-08' })
    expect(same.currentCents).toBe(same.referenceCents)
    expect(same.deltaCents).toBe(0)
  })
})

describe('listSuppliers', () => {
  it('sums every supplier, biggest first, and labels invoices without supplier', () => {
    expect(listSuppliers(rows).map((s) => [s.name, s.totalCents, s.count])).toEqual([
      ['Engie', 50000, 2],
      ['Veolia', 37000, 3],
      ['Nettoyage Pro', 8000, 1],
      [UNKNOWN_SUPPLIER, 1999, 1],
    ])
  })
})

describe('buildSupplierHistory', () => {
  const history = buildSupplierHistory(rows, 'Veolia')

  it('summarises all invoices of the supplier, newest first', () => {
    expect(history.count).toBe(3)
    expect(history.totalCents).toBe(37000)
    expect(history.averageCents).toBe(12333)
    expect(history.invoices.map((invoice) => invoice.id)).toEqual(['7', '2', '1'])
  })

  it('spreads amounts by year and month', () => {
    expect(history.years.map((year) => year.year)).toEqual(['2025', '2026'])
    expect(history.years[0].monthCents[7]).toBe(10000)
    expect(history.years[1].monthCents[7]).toBe(15000)
    expect(history.years[1].monthCents[8]).toBe(12000)
    expect(history.years[1].totalCents).toBe(27000)
  })

  it('is empty for an unknown supplier', () => {
    expect(buildSupplierHistory(rows, 'Inconnu')).toMatchObject({ count: 0, totalCents: 0, averageCents: 0, years: [] })
  })
})
