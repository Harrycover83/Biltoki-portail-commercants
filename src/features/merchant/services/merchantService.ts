import { getSupabaseClient } from '../../../lib/supabase'
import type {
  ChargeLine,
  MerchantChargePeriodDetail,
  MerchantDashboardSummary,
  MerchantHistoryRow,
} from '../../../types/domain'

type ServiceResult<T> = {
  data: T | null
  error: string | null
}

type AllocationRow = {
  period_id: string
  allocated_amount: number
  allocation_percentage: number
  merchant_linear_meters: number
  total_linear_meters: number
  service_charges: {
    id: string
    label: string
    category: string | null
    amount_incl_tax: number
  } | null
  service_charge_periods: {
    id: string
    label: string
    period_end: string
    halls: {
      name: string
    } | null
  } | null
  stands: {
    name: string
    number: string | null
  } | null
  merchants: {
    trade_name: string | null
    legal_name: string
  } | null
}

type AllocationRowRaw = Omit<
  AllocationRow,
  'service_charges' | 'service_charge_periods' | 'stands' | 'merchants'
> & {
  service_charges: AllocationRow['service_charges'] | AllocationRow['service_charges'][]
  service_charge_periods:
    | AllocationRow['service_charge_periods']
    | AllocationRow['service_charge_periods'][]
  stands: AllocationRow['stands'] | AllocationRow['stands'][]
  merchants: AllocationRow['merchants'] | AllocationRow['merchants'][]
}

function singleOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

function normalizeAllocationRows(rows: AllocationRowRaw[]): AllocationRow[] {
  return rows.map((row) => ({
    ...row,
    service_charges: singleOrNull(row.service_charges),
    service_charge_periods: singleOrNull(row.service_charge_periods),
    stands: singleOrNull(row.stands),
    merchants: singleOrNull(row.merchants),
  }))
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

function toNumber(value: number): number {
  return Number(value)
}

function mapChargeLines(rows: AllocationRow[]): ChargeLine[] {
  return rows
    .filter((row) => row.service_charges)
    .map((row) => ({
      id: row.service_charges!.id,
      label: row.service_charges!.label,
      category: row.service_charges!.category,
      totalCents: toCents(toNumber(row.service_charges!.amount_incl_tax)),
      allocatedCents: toCents(toNumber(row.allocated_amount)),
    }))
}

async function fetchMerchantAllocations(): Promise<ServiceResult<AllocationRow[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { data: null, error: 'Supabase non configure.' }
  }

  const { data, error } = await client
    .from('allocations')
    .select(
      `
      period_id,
      allocated_amount,
      allocation_percentage,
      merchant_linear_meters,
      total_linear_meters,
      service_charges:service_charges!inner(
        id,
        label,
        category,
        amount_incl_tax
      ),
      service_charge_periods:service_charge_periods!inner(
        id,
        label,
        period_end,
        halls:halls!inner(name)
      ),
      stands:stands!inner(name, number),
      merchants:merchants!inner(trade_name, legal_name)
    `,
    )
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  return {
    data: normalizeAllocationRows((data ?? []) as unknown as AllocationRowRaw[]),
    error: null,
  }
}

export async function getMerchantDashboardSummary(): Promise<ServiceResult<MerchantDashboardSummary>> {
  const { data, error } = await fetchMerchantAllocations()
  if (error) {
    return { data: null, error }
  }

  if (!data || data.length === 0) {
    return { data: null, error: null }
  }

  const latestRow = data.reduce((latest, row) => {
    const current = row.service_charge_periods?.period_end ?? ''
    const candidate = latest.service_charge_periods?.period_end ?? ''
    return current > candidate ? row : latest
  }, data[0])

  const latestPeriodId = latestRow.period_id
  const latestPeriodRows = data.filter((row) => row.period_id === latestPeriodId)

  const totalChargesCents = latestPeriodRows.reduce(
    (sum, row) => sum + toCents(toNumber(row.allocated_amount)),
    0,
  )

  const first = latestPeriodRows[0]
  const merchantName =
    first?.merchants?.trade_name ?? first?.merchants?.legal_name ?? 'Commercant'
  const hallName = first?.service_charge_periods?.halls?.name ?? 'Halle inconnue'
  const standName = first?.stands?.name ?? 'Stand inconnu'
  const standNumber = first?.stands?.number ?? 'N/A'
  const linearMeters = toNumber(first?.merchant_linear_meters ?? 0)
  const totalLinearMeters = toNumber(first?.total_linear_meters ?? 0)
  const allocationPercentage = toNumber(first?.allocation_percentage ?? 0)

  return {
    data: {
      merchantName,
      hallName,
      standName,
      standNumber,
      periodLabel: first?.service_charge_periods?.label ?? 'Periode inconnue',
      totalChargesCents,
      allocationPercentage,
      linearMeters,
      totalLinearMeters,
    },
    error: null,
  }
}

export async function getMerchantHistory(): Promise<ServiceResult<MerchantHistoryRow[]>> {
  const { data, error } = await fetchMerchantAllocations()
  if (error) {
    return { data: null, error }
  }

  if (!data || data.length === 0) {
    return { data: [], error: null }
  }

  const rowsByPeriod = new Map<string, MerchantHistoryRow>()

  for (const row of data) {
    const periodId = row.period_id
    const periodLabel = row.service_charge_periods?.label ?? 'Periode inconnue'
    const periodEnd = row.service_charge_periods?.period_end ?? ''
    const allocated = toCents(toNumber(row.allocated_amount))

    const existing = rowsByPeriod.get(periodId)
    if (!existing) {
      rowsByPeriod.set(periodId, {
        periodId,
        periodLabel,
        totalAllocatedCents: allocated,
        periodEnd,
      })
      continue
    }

    existing.totalAllocatedCents += allocated
  }

  const history = [...rowsByPeriod.values()].sort((a, b) =>
    b.periodEnd.localeCompare(a.periodEnd),
  )

  return { data: history, error: null }
}

export async function getMerchantChargePeriodDetail(
  periodId: string,
): Promise<ServiceResult<MerchantChargePeriodDetail>> {
  const { data, error } = await fetchMerchantAllocations()
  if (error) {
    return { data: null, error }
  }

  const rows = (data ?? []).filter((row) => row.period_id === periodId)
  if (rows.length === 0) {
    return { data: null, error: null }
  }

  const totalAllocatedCents = rows.reduce(
    (sum, row) => sum + toCents(toNumber(row.allocated_amount)),
    0,
  )
  const totalCommonChargesCents = rows.reduce(
    (sum, row) => sum + toCents(toNumber(row.service_charges?.amount_incl_tax ?? 0)),
    0,
  )

  const first = rows[0]
  const lines = mapChargeLines(rows)

  return {
    data: {
      periodId,
      periodLabel: first.service_charge_periods?.label ?? 'Periode inconnue',
      totalCommonChargesCents,
      totalAllocatedCents,
      linearMeters: toNumber(first.merchant_linear_meters),
      totalLinearMeters: toNumber(first.total_linear_meters),
      allocationPercentage: toNumber(first.allocation_percentage),
      lines,
    },
    error: null,
  }
}
