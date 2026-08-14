export type RuntimeConfig = {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
}

export function getRuntimeConfig(): RuntimeConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? null
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? null

  return { supabaseUrl, supabaseAnonKey }
}

export function hasSupabaseConfig(config: RuntimeConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}
