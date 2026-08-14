import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const tables = await client.query(`
    select table_name
    from information_schema.columns
    where table_schema = 'auth' and column_name = 'instance_id'
    order by table_name
  `)

  for (const row of tables.rows) {
    const table = row.table_name
    const values = await client.query(`select distinct instance_id from auth.${table} order by instance_id nulls first limit 20`)
    console.log(`${table} -> ${JSON.stringify(values.rows)}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
