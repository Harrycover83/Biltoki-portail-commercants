import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import { adminChargeDate } from '@/features/admin/services/adminChargeService'

export const UNKNOWN_SUPPLIER = 'Créancier inconnu'
export const UNCATEGORIZED = 'Sans catégorie'

export type Granularity = 'month' | 'year'
export type GroupBy = 'supplier' | 'category'

export function chargeCents(row: AdminChargeRow): number {
  return Math.round(Number(row.amount_incl_tax) * 100)
}

export function supplierOf(row: AdminChargeRow): string {
  return row.supplier_name?.trim() || UNKNOWN_SUPPLIER
}

function categoryOf(row: AdminChargeRow): string {
  return row.category?.trim() || UNCATEGORIZED
}

/** 'YYYY-MM' for a month, 'YYYY' for a year, taken from the ISO date of the invoice. */
export function periodKeyOf(row: AdminChargeRow, granularity: Granularity): string {
  return adminChargeDate(row).slice(0, granularity === 'month' ? 7 : 4)
}

/** Moves a period key by whole months (or years); `shiftPeriodKey('2026-08', 'month', -12)` is '2025-08'. */
export function shiftPeriodKey(key: string, granularity: Granularity, delta: number): string {
  if (granularity === 'year') {
    return String(Number(key) + delta)
  }
  const [year, month] = key.split('-').map(Number)
  const index = year * 12 + (month - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Every period between the oldest and the newest invoice (gaps included), newest first. */
export function listPeriodKeys(rows: AdminChargeRow[], granularity: Granularity): string[] {
  const present = rows.map((row) => periodKeyOf(row, granularity)).sort()
  if (present.length === 0) {
    return []
  }

  const keys: string[] = []
  const last = present[present.length - 1]
  for (let key = present[0]; key <= last; key = shiftPeriodKey(key, granularity, 1)) {
    keys.push(key)
  }
  return keys.reverse()
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** '2026-08' -> 'août 2026', '2026' -> '2026'. */
export function formatPeriodKey(key: string): string {
  if (key.length === 4) {
    return key
  }
  const [year, month] = key.split('-').map(Number)
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, month - 1, 1)))
}

export type ComparisonLine = {
  name: string
  currentCents: number
  referenceCents: number
  deltaCents: number
  /** Relative change versus the reference, null when the reference is zero. */
  deltaPct: number | null
  currentCount: number
  referenceCount: number
}

export type PeriodComparison = {
  currentCents: number
  referenceCents: number
  deltaCents: number
  deltaPct: number | null
  currentCount: number
  referenceCount: number
  /** Biggest absolute changes first. */
  lines: ComparisonLine[]
}

export function percentChange(currentCents: number, referenceCents: number): number | null {
  return referenceCents === 0 ? null : ((currentCents - referenceCents) / Math.abs(referenceCents)) * 100
}

export function comparePeriods(
  rows: AdminChargeRow[],
  options: { granularity: Granularity; groupBy: GroupBy; current: string; reference: string },
): PeriodComparison {
  const { granularity, groupBy, current, reference } = options
  const nameOf = groupBy === 'supplier' ? supplierOf : categoryOf
  const linesByName = new Map<string, ComparisonLine>()
  const totals = { currentCents: 0, referenceCents: 0, currentCount: 0, referenceCount: 0 }

  for (const row of rows) {
    const key = periodKeyOf(row, granularity)
    const sides = [key === current ? 'current' : null, key === reference ? 'reference' : null] as const
    const name = nameOf(row)
    const cents = chargeCents(row)

    for (const side of sides) {
      if (!side) {
        continue
      }
      const line = linesByName.get(name) ?? {
        name,
        currentCents: 0,
        referenceCents: 0,
        deltaCents: 0,
        deltaPct: null,
        currentCount: 0,
        referenceCount: 0,
      }
      line[`${side}Cents`] += cents
      line[`${side}Count`] += 1
      totals[`${side}Cents`] += cents
      totals[`${side}Count`] += 1
      linesByName.set(name, line)
    }
  }

  const lines = [...linesByName.values()]
    .map((line) => ({
      ...line,
      deltaCents: line.currentCents - line.referenceCents,
      deltaPct: percentChange(line.currentCents, line.referenceCents),
    }))
    .sort(
      (left, right) =>
        Math.abs(right.deltaCents) - Math.abs(left.deltaCents) ||
        right.currentCents - left.currentCents ||
        left.name.localeCompare(right.name, 'fr-FR'),
    )

  return {
    ...totals,
    deltaCents: totals.currentCents - totals.referenceCents,
    deltaPct: percentChange(totals.currentCents, totals.referenceCents),
    lines,
  }
}

export type SupplierSummary = { name: string; totalCents: number; count: number }

/** Suppliers with their all-time total, biggest first. */
export function listSuppliers(rows: AdminChargeRow[]): SupplierSummary[] {
  const byName = new Map<string, SupplierSummary>()
  for (const row of rows) {
    const name = supplierOf(row)
    const summary = byName.get(name) ?? { name, totalCents: 0, count: 0 }
    summary.totalCents += chargeCents(row)
    summary.count += 1
    byName.set(name, summary)
  }
  return [...byName.values()].sort(
    (left, right) => right.totalCents - left.totalCents || left.name.localeCompare(right.name, 'fr-FR'),
  )
}

export type SupplierHistory = {
  totalCents: number
  count: number
  averageCents: number
  /** Newest first. */
  invoices: AdminChargeRow[]
}

export function buildSupplierHistory(rows: AdminChargeRow[], supplier: string): SupplierHistory {
  const invoices = rows
    .filter((row) => supplierOf(row) === supplier)
    .sort((left, right) => adminChargeDate(right).localeCompare(adminChargeDate(left)))
  const totalCents = invoices.reduce((sum, row) => sum + chargeCents(row), 0)

  return {
    totalCents,
    count: invoices.length,
    averageCents: invoices.length > 0 ? Math.round(totalCents / invoices.length) : 0,
    invoices,
  }
}
