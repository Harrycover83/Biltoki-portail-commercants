import { getSupabaseClient } from '../../../lib/supabase'

export async function triggerPennylaneSync(hallId: string, periodId: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient()
  if (!client) {
    return { error: 'Supabase non configure.' }
  }

  const { error } = await client.functions.invoke('pennylane-sync', {
    body: { hallId, periodId },
  })

  return { error: error?.message ?? null }
}
