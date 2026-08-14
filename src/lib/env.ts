export type RuntimeConfig = {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
}

// build: 2026-08-14-v2
const LEGACY_SUPABASE_REF = 'pxjikfmdrzqzccuulxda'
const FORCED_SUPABASE_URL = 'https://ocgesbspdhxisnrzotfx.supabase.co'
const FORCED_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZ2VzYnNwZGh4aXNucnpvdGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDk0ODQsImV4cCI6MjEwMjI4NTQ4NH0.WEXlwzzsdRMS9b2CQ7iqt2tueVVy15owrReIv7sCO5w'

function hasLegacyRef(url: string | null): boolean {
  return Boolean(url && url.includes(LEGACY_SUPABASE_REF))
}

export function getRuntimeConfig(): RuntimeConfig {
  const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? null
  const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? null

  if (hasLegacyRef(envSupabaseUrl)) {
    return {
      supabaseUrl: FORCED_SUPABASE_URL,
      supabaseAnonKey: FORCED_SUPABASE_ANON_KEY,
    }
  }

  return {
    supabaseUrl: envSupabaseUrl,
    supabaseAnonKey: envSupabaseAnonKey,
  }
}

export function hasSupabaseConfig(config: RuntimeConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}
