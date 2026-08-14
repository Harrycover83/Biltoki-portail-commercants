import { Client } from 'pg'

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function q(label, sql) {
  const result = await client.query(sql)
  console.log(`\n=== ${label} ===`)
  console.log(JSON.stringify(result.rows, null, 2))
}

try {
  await client.connect()

  await q('auth table counts', `
    select 'users' as table, count(*)::int as count from auth.users
    union all
    select 'identities' as table, count(*)::int as count from auth.identities
    union all
    select 'instances' as table, count(*)::int as count from auth.instances
  `)

  await q('auth.users null/empty email', `
    select id, email, instance_id, created_at
    from auth.users
    where email is null or trim(email) = ''
    order by created_at desc
    limit 20
  `)

  await q('auth.users duplicate emails', `
    select lower(email) as email_lower, count(*)::int as n
    from auth.users
    where email is not null
    group by lower(email)
    having count(*) > 1
    order by n desc
    limit 20
  `)

  await q('auth.identities duplicate provider tuples', `
    select provider, provider_id, count(*)::int as n
    from auth.identities
    group by provider, provider_id
    having count(*) > 1
    order by n desc
    limit 20
  `)

  await q('auth.instances rows', `
    select *
    from auth.instances
  `)

  await q('auth.audit_log_entries latest', `
    select id, payload, created_at, ip_address
    from auth.audit_log_entries
    order by created_at desc
    limit 20
  `)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
