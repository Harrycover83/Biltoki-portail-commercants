import { getSupabaseClient } from '../../../lib/supabase'
import type {
  ChargeLine,
  MerchantChargePeriodDetail,
  MerchantDashboardSummary,
  MerchantHallOption,
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
  hall_id: string
  created_at: string
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

async function fetchCurrentUserDisplayName(): Promise<string> {
  const client = getSupabaseClient()
  if (!client) {
    return 'Commercant'
  }

  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return 'Commercant'
  }

  const first = (user.user_metadata?.first_name as string | undefined)?.trim()
  const last = (user.user_metadata?.last_name as string | undefined)?.trim()

  const fullName = [first, last].filter(Boolean).join(' ')
  if (fullName.length > 0) {
    return fullName
  }

  const email = user.email ?? ''
  if (email.includes('@')) {
    return email.split('@')[0]
  }

  return 'Commercant'
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
      hall_id,
      created_at,
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

  if (error) {
    return { data: null, error: error.message }
  }

  return {
    data: normalizeChargeRows((data ?? []) as unknown as ServiceChargeRowRaw[]),
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

export async function getMerchantDashboardSummary(hallId?: string): Promise<ServiceResult<MerchantDashboardSummary>> {
  const [chargesResult, merchantName] = await Promise.all([
    fetchVisibleServiceCharges(),
    fetchCurrentUserDisplayName(),
  ])

  const { data, error } = chargesResult
  if (error) {
    return { data: null, error }
  }

  const hallRows = filterByHall(data ?? [], hallId)
  if (hallRows.length === 0) {
    return { data: null, error: null }
  }

  const latestPeriodId = hallRows[0].period_id
  const latestRows = hallRows.filter((row) => row.period_id === latestPeriodId)
  const totalChargesCents = latestRows.reduce(
    (sum, row) => sum + toCents(Number(row.amount_incl_tax)),
    0,
  )

  const first = latestRows[0]

  return {
    data: {
      merchantName,
      hallId: first.hall_id,
      hallName: first.halls?.name ?? 'Halle inconnue',
      periodLabel: first.service_charge_periods?.label ?? 'Periode inconnue',
      totalChargesCents,
      lineCount: latestRows.length,
    },
    error: null,
  }
}

export async function getMerchantHistory(hallId?: string): Promise<ServiceResult<MerchantHistoryRow[]>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  const rows = filterByHall(data ?? [], hallId)
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
  hallId?: string,
): Promise<ServiceResult<MerchantChargePeriodDetail>> {
  const { data, error } = await fetchVisibleServiceCharges()
  if (error) {
    return { data: null, error }
  }

  const rows = filterByHall(data ?? [], hallId).filter((row) => row.period_id === periodId)
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
