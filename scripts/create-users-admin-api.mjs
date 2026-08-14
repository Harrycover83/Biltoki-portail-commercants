const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const usersToCreate = [
  { email: 'jean.merchant@example.com', password: 'Biltoki2026' },
  { email: 'admin.biltoki@example.com', password: 'Biltoki2026' },
]

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }

  return { status: response.status, ok: response.ok, payload }
}

async function createUser(user) {
  return request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
    }),
  })
}

const results = []
for (const user of usersToCreate) {
  const result = await createUser(user)
  results.push({ email: user.email, ...result })
}

console.log(JSON.stringify(results, null, 2))
