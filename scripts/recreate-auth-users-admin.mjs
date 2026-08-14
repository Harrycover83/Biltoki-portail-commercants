const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const usersToEnsure = [
  { email: 'jean.merchant@example.com', password: 'Biltoki2026' },
  { email: 'admin.biltoki@example.com', password: 'Biltoki2026' },
]

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
}

async function api(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${JSON.stringify(data)}`)
  }

  return data
}

function findByEmail(payload, email) {
  const list = payload?.users ?? payload ?? []
  return list.find((user) => String(user.email).toLowerCase() === email.toLowerCase())
}

async function main() {
  const listed = await api('/auth/v1/admin/users?page=1&per_page=100')

  for (const target of usersToEnsure) {
    const existing = findByEmail(listed, target.email)
    if (existing?.id) {
      await api(`/auth/v1/admin/users/${existing.id}`, { method: 'DELETE' })
    }
  }

  const created = []
  for (const target of usersToEnsure) {
    const user = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: target.email,
        password: target.password,
        email_confirm: true,
      }),
    })
    created.push({ id: user.id, email: user.email })
  }

  console.log(JSON.stringify(created, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
