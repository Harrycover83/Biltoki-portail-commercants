import { getSupabaseClient } from './supabase'

/** Access token of the signed-in user, used to call the backend API. */
export async function getAccessToken(): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) {
    return null
  }

  const {
    data: { session },
  } = await client.auth.getSession()
  return session?.access_token ?? null
}
