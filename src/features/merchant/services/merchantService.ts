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

type ServiceChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
  period_id: string
  created_at: string
  service_charge_periods: {
    id: string
    label: string
    period_end: string
    halls: {
      name: string
    } | null
  } | null
}

type ServiceChargeRowRaw = Omit<ServiceChargeRow, 'service_charge_periods'> & {
  service_charge_periods: ServiceChargeRow['service_charge_periods'] | ServiceChargeRow['service_charge_periods'][]
}

type MerchantIdentity = {
  merchantName: string
  hallName: string
}

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
  }))
}

async function fetchMerchantIdentity(): Promise<ServiceResult<MerchantIdentity>> {
  const client = getSupabaseClient()
  if (!client) {
    return { data: null, error: 'Supabase non configure.' }
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError || !user) {
    return { data: null, error: authError?.message ?? 'Utilisateur non authentifie.' }
  }

  const { data, error } = await client
    .from('profiles')
    .select(
      `
      merchants:merchants!profiles_merchant_id_fkey(
        trade_name,
        legal_name,
        halls:halls!merchants_hall_id_fkey(name)
      )
    `,
    )
    .eq('id', user.id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  const merchantsValue = (data as { merchants: unknown }).merchants as
    | {
        trade_name: string | null
        legal_name: string
        halls: { name: string } | null
      }
    | {
        trade_name: string | null
        legal_name: string
        halls: { name: string } | null
      }[]
    | null

  const merchant = singleOrNull(merchantsValue)

  return {
    data: {
      merchantName: merchant?.trade_name ?? merchant?.legal_name ?? 'Commercant',
      hallName: merchant?.halls?.name ?? 'Halle inconnue',
    },
    error: null,
  }
}

async function fetchVisibleServiceCharges(): Promise<ServiceResult<ServiceChargeRow[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { data: null, error: 'Supabase non configure.' }
  }

  const { data, error } = await client
    .from('service_charges')
    .select(
      `
      id,
      label,
      category,
      amount_incl_tax,
      period_id,
      created_at,
      service_charge_periods:service_charge_periods!inner(
        id,
        label,
        period_end,
        halls:halls!inner(name)
      )
    `,
    )
    .order('period_end', {
      referencedTable: 'service_charge_periods',
      ascending: false,
    })
    .order('label', { ascending: true })

  if (error) {
    return { data: null, error: error.message }
  }

  return {
    data: normalizeChargeRows((data ?? []) as unknown as ServiceChargeRowRaw[]),
    error: null,
  }
}

export async function getMerchantDashboardSummary(): Promise<ServiceResult<MerchantDashboardSummary>> {
  const [identityResult, chargesResult] = await Promise.all([
    fetchMerchantIdentity(),
    fetchVisibleServiceCharges(),
  ])

  if (identityResult.error) {
    return { data: null, error: identityResult.error }
  }

  if (chargesResult.error) {
    return { data: null, error: chargesResult.error }
  }

  const rows = chargesResult.data ?? []
  if (rows.length === 0) {
    return { data: null, error: null }
  }

  const latestPeriodId = rows[0].period_id
  const latestRows = rows.filter((row) => row.period_id === latestPeriodId)
  const totalChargesCents = latestRows.reduce(
    (sum, row) => sum + toCents(Number(row.amount_incl_tax)),
    0,
  )

  return {
    data: {
      merchantName: identityResult.data?.merchantName ?? 'Commercant',
      hallName: identityResult.data?.hallName ?? latestRows[0].service_charge_periods?.halls?.name ?? 'Halle inconnue',
      periodLabel: latestRows[0].service_charge_periods?.label ?? 'Periode inconnue',
      totalChargesCents,
      lineCount: latestRows.length,
    },
    error: null,
  }
}

export async function getMerchantHistory(): Promise<ServiceResult<MerchantHistoryRow[]>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const rowsByPeriod = new Map<string, MerchantHistoryRow>()

  for (const row of rows) {
    const periodId = row.period_id
    const periodLabel = row.service_charge_periods?.label ?? 'Periode inconnue'
    const periodEnd = row.service_charge_periods?.period_end ?? ''
    const totalCharge = toCents(Number(row.amount_incl_tax))

    const existing = rowsByPeriod.get(periodId)
    if (!existing) {
      rowsByPeriod.set(periodId, {
        periodId,
        periodLabel,
        totalChargesCents: totalCharge,
        periodEnd,
      })
      continue
    }

    existing.totalChargesCents += totalCharge
  }

  const history = [...rowsByPeriod.values()].sort((a, b) =>
    b.periodEnd.localeCompare(a.periodEnd),
  )

  return { data: history, error: null }
}

export async function getMerchantChargePeriodDetail(
  periodId: string,
): Promise<ServiceResult<MerchantChargePeriodDetail>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  const rows = (data ?? []).filter((row) => row.period_id === periodId)
  if (rows.length === 0) {
    return { data: null, error: null }
  }

  const lines = mapChargeLines(rows)
  const totalChargesCents = lines.reduce((sum, row) => sum + row.totalCents, 0)

  return {
    data: {
      periodId,
      periodLabel: rows[0].service_charge_periods?.label ?? 'Periode inconnue',
      totalChargesCents,
      lines,
    },
    error: null,
  }
}
