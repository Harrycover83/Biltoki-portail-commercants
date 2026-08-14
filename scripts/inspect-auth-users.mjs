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
    select
      email,
      aud,
      role,
      encrypted_password,
      email_confirmed_at,
      crypt('TempM3rchant!2026', encrypted_password) = encrypted_password as merchant_password_matches,
      crypt('TempAdm1n!2026', encrypted_password) = encrypted_password as admin_password_matches
    from auth.users
    where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com')
    order by email
  `)

  const rows = result.rows.map((row) => ({
    email: row.email,
    aud: row.aud,
    role: row.role,
    hasEncryptedPassword: Boolean(row.encrypted_password),
    encryptedPasswordPrefix: row.encrypted_password?.slice(0, 7) ?? null,
    emailConfirmed: Boolean(row.email_confirmed_at),
    merchantPasswordMatches: row.merchant_password_matches,
    adminPasswordMatches: row.admin_password_matches,
  }))

  console.log(JSON.stringify(rows, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
} finally {
  await client.end().catch(() => undefined)
}
