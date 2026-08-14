import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const instances = await client.query('select * from auth.instances')
  const users = await client.query(`
    select id, email, instance_id, aud, role, email_confirmed_at, deleted_at
    from auth.users
    where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by email
  `)

  console.log('instances=', JSON.stringify(instances.rows, null, 2))
  console.log('users=', JSON.stringify(users.rows, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
