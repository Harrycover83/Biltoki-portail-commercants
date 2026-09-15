import { getSupabaseClient } from '../../../lib/supabase'

export type AdminChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
  pennylane_id: string | null
  invoice_date: string | null
  period_end: string
  created_at: string
}

type RawAdminChargeRow = Omit<AdminChargeRow, 'period_end'> & {
  service_charge_periods: { period_end: string } | { period_end: string }[] | null
}

type AdminChargeResult = {
  data: AdminChargeRow[] | null
  error: string | null
}

const CHARGES_PAGE_SIZE = 1000

export function adminChargeDate(row: AdminChargeRow): string {
  return row.invoice_date ?? row.period_end ?? row.created_at
}

export async function getAdminCharges(hallId: string): Promise<AdminChargeResult> {
  const client = getSupabaseClient()
  if (!client) {
    return { data: null, error: 'Supabase non configure.' }
  }

  const allRows: unknown[] = []
  let from = 0

  do {
    const { data, error } = await client
      .from('service_charges')
      .select('id, label, category, amount_incl_tax, pennylane_id, invoice_date, created_at, service_charge_periods!inner(period_end)')
      .eq('hall_id', hallId)
      .order('invoice_date', { ascending: false })
      .range(from, from + CHARGES_PAGE_SIZE - 1)

    if (error) {
      return { data: null, error: error.message }
    }

    allRows.push(...(data ?? []))
    if ((data ?? []).length < CHARGES_PAGE_SIZE) {
      break
    }
    from += CHARGES_PAGE_SIZE
  } while (true)

  const normalized = (allRows as RawAdminChargeRow[]).map((row) => {
    const relation = row.service_charge_periods
    const periodEnd = (Array.isArray(relation) ? relation[0]?.period_end : relation?.period_end) ?? row.created_at
    return { ...row, period_end: periodEnd }
  })

  return { data: normalized, error: null }
}