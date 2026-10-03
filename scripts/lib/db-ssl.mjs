import { readFileSync } from 'node:fs'

/**
 * TLS settings for database scripts. Certificates are verified by default.
 *   SUPABASE_DB_CA_FILE=<path to the Supabase CA .crt>   verify against the Supabase CA bundle
 *                                                         (Dashboard > Database > SSL Configuration)
 *   SUPABASE_DB_ALLOW_INSECURE_TLS=1                      explicit opt-out (not recommended)
 */
export function getDbSslConfig() {
  const caFile = process.env.SUPABASE_DB_CA_FILE
  if (caFile) {
    return { ca: readFileSync(caFile, 'utf-8'), rejectUnauthorized: true }
  }

  if (process.env.SUPABASE_DB_ALLOW_INSECURE_TLS === '1') {
    console.warn('WARNING: database TLS certificate verification is disabled.')
    return { rejectUnauthorized: false }
  }

  return { rejectUnauthorized: true }
}
