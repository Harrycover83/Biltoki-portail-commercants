import { createClient } from '@supabase/supabase-js'
import type { Config } from './config'
import type { Logger } from './utils/logger'

export function createSupabaseAdmin(config: Config, logger: Logger) {
  logger.info('Initializing Supabase Admin client...')

  const client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return client
}

export type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>

export async function verifySupabaseConnection(client: SupabaseAdmin, logger: Logger): Promise<boolean> {
  try {
    const { data, error } = await client.from('halls').select('id').limit(1)
    if (error) {
      logger.error('Supabase verification failed:', error)
      return false
    }
    logger.info('✅ Supabase connection verified')
    return true
  } catch (err) {
    logger.error('Supabase verification error:', err)
    return false
  }
}
