const supabaseUrl = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(1)
}

const users = [
  { email: 'jean.merchant@example.com', password: 'Biltoki2026' },
  { email: 'admin.biltoki@example.com', password: 'Biltoki2026' },
]

async function login(user) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  return {
    email: user.email,
    status: response.status,
    ok: response.ok,
    hasAccessToken: Boolean(payload?.access_token),
    error: payload?.msg ?? null,
  }
}

const results = []
for (const user of users) {
  results.push(await login(user))
}

console.log(JSON.stringify(results, null, 2))
