import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import { adminChargeDate } from '@/features/admin/services/adminChargeService'

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export const MAX_CHART_SUPPLIERS = 8
export const OTHER_SUPPLIERS_KEY = 'other_suppliers'
const UNKNOWN_SUPPLIER = 'Créancier inconnu'

export type SupplierCount = { name: string; count: number }
export type ChartSeries = { name: string; dataKey: string }
export type ChartPoint = Record<string, string | number>

/** Case- and accent-insensitive form used for supplier search. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
}

export function amountCents(row: AdminChargeRow): number {
  return Math.round(Number(row.amount_incl_tax) * 100)
}

/** Distinct suppliers with their invoice count, sorted by name. */
export function buildSupplierCatalog(rows: AdminChargeRow[]): SupplierCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.supplier_name) {
      counts.set(row.supplier_name, (counts.get(row.supplier_name) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr-FR'))
}

export function filterSuppliers(suppliers: SupplierCount[], query: string): SupplierCount[] {
  const term = normalizeSearch(query)
  return term ? suppliers.filter(({ name }) => normalizeSearch(name).includes(term)) : suppliers
}

/** Rows of the selected suppliers (all rows when none is selected), oldest first. */
export function selectChargeRows(rows: AdminChargeRow[], selectedSuppliers: string[]): AdminChargeRow[] {
  const filtered =
    selectedSuppliers.length > 0
      ? rows.filter((row) => row.supplier_name !== null && selectedSuppliers.includes(row.supplier_name))
      : rows

  return [...filtered].sort((left, right) => adminChargeDate(left).localeCompare(adminChargeDate(right)))
}

/** One series per top supplier (by amount), plus an aggregated series for the rest. */
export function buildChartSeries(rows: AdminChargeRow[]): ChartSeries[] {
  const totalsBySupplier = new Map<string, number>()
  for (const row of rows) {
    const supplierName = row.supplier_name ?? UNKNOWN_SUPPLIER
    totalsBySupplier.set(supplierName, (totalsBySupplier.get(supplierName) ?? 0) + Number(row.amount_incl_tax))
  }

  const suppliersByAmount = [...totalsBySupplier.entries()].sort(([, left], [, right]) => right - left)

  return [
    ...suppliersByAmount.slice(0, MAX_CHART_SUPPLIERS).map(([name], index) => ({ name, dataKey: `supplier_${index}` })),
    ...(suppliersByAmount.length > MAX_CHART_SUPPLIERS
      ? [{ name: 'Autres créanciers', dataKey: OTHER_SUPPLIERS_KEY }]
      : []),
  ]
}

/** Chart points (one per invoice date) summing the amounts of each series. */
export function buildChartData(rows: AdminChargeRow[], series: ChartSeries[]): ChartPoint[] {
  const seriesByName = new Map(series.map((entry) => [entry.name, entry.dataKey]))
  const hasOthers = series.some((entry) => entry.dataKey === OTHER_SUPPLIERS_KEY)
  const pointsByDate = new Map<string, ChartPoint>()

  for (const row of rows) {
    const dateKey = adminChargeDate(row)
    const dataKey = seriesByName.get(row.supplier_name ?? UNKNOWN_SUPPLIER) ?? (hasOthers ? OTHER_SUPPLIERS_KEY : undefined)
    if (!dataKey) {
      continue
    }

    const point = pointsByDate.get(dateKey) ?? { dateKey, date: DATE_FORMATTER.format(new Date(dateKey)) }
    point[dataKey] = Number(point[dataKey] ?? 0) + Number(row.amount_incl_tax)
    pointsByDate.set(dateKey, point)
  }

  return [...pointsByDate.values()].sort((left, right) => String(left.dateKey).localeCompare(String(right.dateKey)))
}
