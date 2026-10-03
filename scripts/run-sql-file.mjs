import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Client } from 'pg'
import { getDbSslConfig } from './lib/db-ssl.mjs'

const connectionString = process.env.SUPABASE_DB_URL
const sqlFiles = process.argv.slice(2)

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL environment variable')
  process.exit(1)
}

if (sqlFiles.length === 0) {
  console.error('Usage: node scripts/run-sql-file.mjs <file.sql> [more files...]')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: getDbSslConfig() })

try {
  await client.connect()

  // Files run one after the other, each in its own transaction, stopping at the first failure.
  // (Needed when a file adds enum values that the next file uses.)
  for (const sqlFile of sqlFiles) {
    const filePath = resolve(sqlFile)
    const sql = await readFile(filePath, 'utf-8')
    await client.query(sql)
    console.log(`SQL applied successfully: ${filePath}`)
  }
} catch (error) {
  console.error('SQL execution failed:', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
