import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  const result = await client.query(
    'select id, email, created_at from auth.users order by created_at desc limit 20',
  )
  console.log(JSON.stringify(result.rows, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
