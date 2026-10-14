import { getSupabaseClient } from '@/lib/supabase'

type ServiceResult<T> = { data: T | null; error: string | null }

const NO_CLIENT = 'Supabase non configure.'

/** Every declared month of the caller's merchant, as `AAAA-MM` → cents (row-level security limits the rows). */
export async function getDeclaredRevenue(): Promise<ServiceResult<Map<string, number>>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: NO_CLIENT }

  const { data, error } = await client
    .from('merchant_revenue_declarations')
    .select('month, amount_cents')
    .order('month', { ascending: true })
    .limit(1200)
  if (error) return { data: null, error: error.message }

  const declared = new Map<string, number>()
  for (const row of (data ?? []) as { month: string; amount_cents: number | string }[]) {
    const cents = Number(row.amount_cents)
    if (Number.isSafeInteger(cents)) declared.set(row.month.slice(0, 7), cents)
  }
  return { data: declared, error: null }
}

/** Creates or replaces the declaration of one month (`AAAA-MM`). */
export async function saveDeclaredRevenue(merchantId: string, month: string, amountCents: number): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return NO_CLIENT
  const { error } = await client
    .from('merchant_revenue_declarations')
    .upsert({ merchant_id: merchantId, month: `${month}-01`, amount_cents: amountCents }, { onConflict: 'merchant_id,month' })
  return error ? error.message : null
}

export async function deleteDeclaredRevenue(merchantId: string, month: string): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return NO_CLIENT
  const { error } = await client
    .from('merchant_revenue_declarations')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('month', `${month}-01`)
  return error ? error.message : null
}
