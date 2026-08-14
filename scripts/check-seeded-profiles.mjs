import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  const result = await client.query(`
    select email, role, merchant_id
    from public.profiles
    where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by email
  `)
  console.log(JSON.stringify(result.rows, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
