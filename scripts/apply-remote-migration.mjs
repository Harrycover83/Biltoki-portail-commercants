import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL environment variable')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const precheck = await client.query(
    "select to_regclass('public.organizations') is not null as organizations_exists",
  )

  const organizationsExists = Boolean(precheck.rows[0]?.organizations_exists)
  if (organizationsExists) {
    console.log('Schema already present (public.organizations exists). Migration skipped.')
    process.exit(0)
  }

  const sql = await readFile('supabase/migrations/20260814124000_init.sql', 'utf-8')

  await client.query(sql)
  console.log('Migration applied successfully.')
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
