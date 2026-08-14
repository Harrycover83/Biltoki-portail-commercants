import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
const sqlFile = process.argv[2]

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL environment variable')
  process.exit(1)
}

if (!sqlFile) {
  console.error('Usage: node scripts/run-sql-file.mjs <path-to-sql-file>')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  const filePath = resolve(sqlFile)
  const sql = await readFile(filePath, 'utf-8')

  await client.connect()
  await client.query(sql)
  console.log(`SQL applied successfully: ${filePath}`)
} catch (error) {
  console.error('SQL execution failed:', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
