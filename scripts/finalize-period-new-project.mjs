import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const periodId = '00000000-0000-0000-0000-000000002001'
const adminEmail = 'admin.biltoki@example.com'

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const admin = await client.query(
    'select id from auth.users where lower(email) = lower($1) limit 1',
    [adminEmail],
  )

  const adminId = admin.rows[0]?.id
  if (!adminId) {
    throw new Error('Admin user not found in auth.users')
  }

  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId])
  await client.query('select public.recalculate_allocations_for_period($1)', [periodId])
  await client.query('select public.close_period($1)', [periodId])

  const allocations = await client.query(
    'select count(*)::int as count from public.allocations where period_id = $1',
    [periodId],
  )

  console.log(JSON.stringify({ periodId, allocations: allocations.rows[0]?.count ?? 0 }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
