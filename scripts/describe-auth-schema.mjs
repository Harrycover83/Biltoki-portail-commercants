import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const cols = await client.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'auth'
      and table_name in ('users', 'identities')
    order by table_name, ordinal_position
  `)

  console.log('COLUMNS')
  for (const row of cols.rows) {
    console.log(`${row.table_name}.${row.column_name} | ${row.data_type} | nullable=${row.is_nullable}`)
  }

  const constraints = await client.query(`
    select tc.table_name, tc.constraint_name, tc.constraint_type
    from information_schema.table_constraints tc
    where tc.table_schema = 'auth'
      and tc.table_name in ('users', 'identities')
    order by tc.table_name, tc.constraint_name
  `)

  console.log('\nCONSTRAINTS')
  for (const row of constraints.rows) {
    console.log(`${row.table_name}.${row.constraint_name} | ${row.constraint_type}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
