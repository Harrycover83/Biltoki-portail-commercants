import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getRuntimeConfig, hasSupabaseConfig } from './env'

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient
  }

  const config = getRuntimeConfig()
  if (!hasSupabaseConfig(config)) {
    return null
  }

  cachedClient = createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return cachedClient
}
