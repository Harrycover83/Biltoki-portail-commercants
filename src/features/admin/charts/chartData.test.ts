import { describe, expect, it } from 'vitest'
import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import {
  amountCents,
  buildChartData,
  buildChartSeries,
  buildSupplierCatalog,
  filterSuppliers,
  MAX_CHART_SUPPLIERS,
  normalizeSearch,
  OTHER_SUPPLIERS_KEY,
  selectChargeRows,
} from './chartData'

function row(id: string, supplier: string | null, amount: number, date: string): AdminChargeRow {
  return {
    id,
    label: id,
    category: null,
    supplier_name: supplier,
    amount_incl_tax: amount,
    pennylane_id: id,
    invoice_date: date,
    period_end: date,
    created_at: date,
  }
}

const rows = [
  row('1', 'Énergie Sud', 120.5, '2026-03-02'),
  row('2', 'Nettoyage Pro', 80, '2026-01-15'),
  row('3', 'Énergie Sud', 99.5, '2026-01-15'),
  row('4', null, 10, '2026-02-01'),
]

describe('supplier catalog', () => {
  it('counts invoices per supplier, sorted by name, ignoring rows without supplier', () => {
    expect(buildSupplierCatalog(rows)).toEqual([
      { name: 'Énergie Sud', count: 2 },
      { name: 'Nettoyage Pro', count: 1 },
    ])
  })

  it('searches without regard to case or accents', () => {
    const catalog = buildSupplierCatalog(rows)
    expect(filterSuppliers(catalog, 'ENERGIE').map((s) => s.name)).toEqual(['Énergie Sud'])
    expect(filterSuppliers(catalog, '  ')).toHaveLength(2)
    expect(normalizeSearch('  Éléphant ')).toBe('elephant')
  })
})

describe('selectChargeRows', () => {
  it('returns every row oldest first when nothing is selected', () => {
    expect(selectChargeRows(rows, []).map((r) => r.id)).toEqual(['2', '3', '4', '1'])
  })

  it('keeps only the selected suppliers', () => {
    expect(selectChargeRows(rows, ['Nettoyage Pro']).map((r) => r.id)).toEqual(['2'])
  })
})

describe('chart series and points', () => {
  it('orders series by amount and labels unknown suppliers', () => {
    expect(buildChartSeries(rows).map((s) => s.name)).toEqual(['Énergie Sud', 'Nettoyage Pro', 'Créancier inconnu'])
  })

  it('groups the long tail of suppliers into one series', () => {
    const many = Array.from({ length: MAX_CHART_SUPPLIERS + 3 }, (_, i) =>
      row(`r${i}`, `Fournisseur ${i}`, 100 - i, '2026-01-01'),
    )
    const series = buildChartSeries(many)

    expect(series).toHaveLength(MAX_CHART_SUPPLIERS + 1)
    expect(series[series.length - 1]).toEqual({ name: 'Autres créanciers', dataKey: OTHER_SUPPLIERS_KEY })

    const [point] = buildChartData(many, series)
    const tail = many.slice(MAX_CHART_SUPPLIERS).reduce((sum, r) => sum + Number(r.amount_incl_tax), 0)
    expect(point[OTHER_SUPPLIERS_KEY]).toBeCloseTo(tail)
  })

  it('sums the amounts of a series per invoice date, in date order', () => {
    const selected = selectChargeRows(rows, [])
    const points = buildChartData(selected, buildChartSeries(selected))

    expect(points.map((p) => p.dateKey)).toEqual(['2026-01-15', '2026-02-01', '2026-03-02'])
    expect(points[0].supplier_0).toBeCloseTo(99.5)
    expect(points[0].supplier_1).toBe(80)
  })

  it('converts amounts to integer cents', () => {
    expect(amountCents(row('x', null, 19.99, '2026-01-01'))).toBe(1999)
  })
})
