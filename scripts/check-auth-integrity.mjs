import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const users = await client.query(`
    select id, email
    from auth.users
    where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by email
  `)

  const identities = await client.query(`
    select i.user_id, i.provider, i.provider_id
    from auth.identities i
    join auth.users u on u.id = i.user_id
    where lower(u.email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by i.provider, i.provider_id
  `)

  console.log('users=', JSON.stringify(users.rows, null, 2))
  console.log('identities=', JSON.stringify(identities.rows, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
