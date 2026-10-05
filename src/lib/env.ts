export type RuntimeConfig = {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
}

export function getBackendUrl(): string | null {
  const url = import.meta.env.VITE_BACKEND_URL ?? null
  return url ? url.replace(/\/+$/, '') : null
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || null,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || null,
  }
}

export function hasSupabaseConfig(config: RuntimeConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}
