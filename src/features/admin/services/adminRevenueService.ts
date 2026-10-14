import type { Declaration, StandMerchant } from '@/features/admin/revenue/standRevenue'
import { getSupabaseClient } from '@/lib/supabase'

type ServiceResult<T> = { data: T | null; error: string | null }

const PAGE_SIZE = 1000

/** Merchants of a hall with their stands and every monthly revenue they declared. Row-level security scopes staff to their halls. */
export async function getHallDeclaredRevenue(hallId: string): Promise<ServiceResult<{ merchants: StandMerchant[]; declarations: Declaration[] }>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Supabase non configure.' }

  const { data: merchants, error: merchantError } = await client
    .from('merchants')
    .select('id, legal_name, trade_name, active, stands(name, number, active)')
    .eq('hall_id', hallId)
  if (merchantError) return { data: null, error: merchantError.message }

  const ids = (merchants ?? []).map((merchant) => merchant.id as string)
  const declarations: Declaration[] = []
  for (let from = 0; ids.length > 0; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('merchant_revenue_declarations')
      .select('merchant_id, month, amount_cents, updated_at')
      .in('merchant_id', ids)
      .order('month', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error: error.message }
    for (const row of (data ?? []) as { merchant_id: string; month: string; amount_cents: number | string; updated_at: string }[]) {
      const cents = Number(row.amount_cents)
      if (Number.isSafeInteger(cents)) declarations.push({ ...row, amount_cents: cents })
    }
    if ((data ?? []).length < PAGE_SIZE) break
  }

  return { data: { merchants: (merchants ?? []) as unknown as StandMerchant[], declarations }, error: null }
}
