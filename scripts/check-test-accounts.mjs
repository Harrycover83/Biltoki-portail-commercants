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

  const profiles = await client.query(`
    select email, role
    from public.profiles
    where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by email
  `)

  console.log(
    JSON.stringify(
      {
        auth_users_count: users.rows.length,
        auth_users: users.rows,
        profiles_count: profiles.rows.length,
        profiles: profiles.rows,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
