import { groupByYearMonth } from '@/lib/grouping'
import { getSupabaseClient } from '@/lib/supabase'
import type {
  ChargeLine,
  MerchantHallOption,
  MerchantYearGroup,
} from '@/types/domain'

type ServiceResult<T> = {
  data: T | null
  error: string | null
}

type ServiceChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
  period_id: string
  hall_id: string
  created_at: string
  invoice_date: string | null
  service_charge_periods: {
    id: string
    label: string
    period_end: string
  } | null
  halls: {
    name: string
  } | null
}

type ServiceChargeRowRaw = Omit<ServiceChargeRow, 'service_charge_periods' | 'halls'> & {
  service_charge_periods: ServiceChargeRow['service_charge_periods'] | ServiceChargeRow['service_charge_periods'][]
  halls: ServiceChargeRow['halls'] | ServiceChargeRow['halls'][]
}

const CHARGES_PAGE_SIZE = 1000

function singleOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

function normalizeChargeRows(rows: ServiceChargeRowRaw[]): ServiceChargeRow[] {
  return rows.map((row) => ({
    ...row,
    service_charge_periods: singleOrNull(row.service_charge_periods),
    halls: singleOrNull(row.halls),
  }))
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function mapChargeLines(rows: ServiceChargeRow[]): ChargeLine[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    category: row.category,
    totalCents: toCents(Number(row.amount_incl_tax)),
    invoiceDate: row.invoice_date,
  }))
}

function buildHallOptions(rows: ServiceChargeRow[]): MerchantHallOption[] {
  const byId = new Map<string, MerchantHallOption>()

  for (const row of rows) {
    if (!byId.has(row.hall_id)) {
      byId.set(row.hall_id, {
        hallId: row.hall_id,
        hallName: row.halls?.name ?? 'Halle inconnue',
      })
    }
  }

  return [...byId.values()].sort((a, b) => a.hallName.localeCompare(b.hallName))
}

function filterByHall(rows: ServiceChargeRow[], hallId?: string): ServiceChargeRow[] {
  if (!hallId) {
    return rows
  }
  return rows.filter((row) => row.hall_id === hallId)
}

async function fetchVisibleServiceCharges(): Promise<ServiceResult<ServiceChargeRow[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { data: null, error: 'Supabase non configure.' }
  }

  const allRows: ServiceChargeRowRaw[] = []
  let from = 0

  for (;;) {
    const { data, error } = await client
      .from('service_charges')
      .select(
        `
        id,
        label,
        category,
        amount_incl_tax,
        period_id,
        hall_id,
        created_at,
        invoice_date,
        service_charge_periods:service_charge_periods!inner(
          id,
          label,
          period_end
        ),
        halls:halls!inner(name)
      `,
      )
      .order('period_end', {
        referencedTable: 'service_charge_periods',
        ascending: false,
      })
      .order('label', { ascending: true })
      .range(from, from + CHARGES_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error: error.message }
    }

    allRows.push(...((data ?? []) as unknown as ServiceChargeRowRaw[]))
    if ((data ?? []).length < CHARGES_PAGE_SIZE) {
      break
    }
    from += CHARGES_PAGE_SIZE
  }

  return {
    data: normalizeChargeRows(allRows),
    error: null,
  }
}

export async function getMerchantHallOptions(): Promise<ServiceResult<MerchantHallOption[]>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  return { data: buildHallOptions(data ?? []), error: null }
}

function chargeDateForGrouping(row: ServiceChargeRow): string {
  return row.invoice_date ?? row.service_charge_periods?.period_end ?? row.created_at
}

/**
 * All charges for a hall, organized as Year -> Month -> chronological charge list.
 * Grouping uses the real Pennylane invoice date (falls back to period end / row
 * creation date for legacy rows synced before invoice_date existed).
 */
export async function getMerchantChargesByYear(hallId?: string): Promise<ServiceResult<MerchantYearGroup[]>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  const rows = filterByHall(data ?? [], hallId)
  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const years: MerchantYearGroup[] = groupByYearMonth(rows, chargeDateForGrouping).map(({ year, months }) => {
    const monthGroups = months.map(({ month, monthLabel, items }) => {
      const charges = mapChargeLines(items)
      return {
        month,
        monthLabel,
        totalChargesCents: charges.reduce((sum, charge) => sum + charge.totalCents, 0),
        charges,
      }
    })

    return {
      year,
      totalChargesCents: monthGroups.reduce((sum, month) => sum + month.totalChargesCents, 0),
      months: monthGroups,
    }
  })

  return { data: years, error: null }
}
