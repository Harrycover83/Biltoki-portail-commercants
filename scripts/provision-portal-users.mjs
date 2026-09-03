#!/usr/bin/env node
/**
 * Provision portal accounts from the `public.portal_access` allowlist.
 *
 * Only emails listed (and active) in `portal_access` get a Supabase auth user.
 * Each account gets its OWN random provisional password plus the
 * `must_change_password` flag, which the portal enforces on first login.
 * Passwords are never stored in the database: they are written once to a local
 * CSV so the operator can distribute them, then that file must be deleted.
 *
 * Usage:
 *   node scripts/provision-portal-users.mjs sync [--dry-run]
 *   node scripts/provision-portal-users.mjs reset <email>
 *   node scripts/provision-portal-users.mjs import <file.csv>
 *
 * Import CSV columns: email,first_name,last_name,role,merchant_name,hall_name
 *   (merchant_id / hall_id may be given directly instead of the names)
 *
 * Env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BAN_FOREVER = '876000h'

// Ambiguous characters (O/0, l/1, I) are excluded: these passwords are read aloud or retyped.
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SPECIALS = '!@#$%&*?'
const PASSWORD_LENGTH = 14

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function pick(alphabet) {
  return alphabet[randomInt(alphabet.length)]
}

function generatePassword() {
  const all = LOWER + UPPER + DIGITS + SPECIALS
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SPECIALS)]

  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pick(all))
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

function writeCredentialsFile(rows) {
  if (rows.length === 0) {
    return null
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `portal-credentials-${stamp}.csv`
  const lines = ['email,mot_de_passe_provisoire', ...rows.map((row) => `${row.email},${row.password}`)]
  writeFileSync(path, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
  return path
}

async function listAuthUsersByEmail() {
  const byEmail = new Map()
  let page = 1

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`)
    }

    for (const user of data.users) {
      if (user.email) {
        byEmail.set(user.email.toLowerCase(), user)
      }
    }

    if (data.users.length < 200) {
      return byEmail
    }
    page += 1
  }
}

async function upsertProfile(entry, userId) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: entry.email,
      first_name: entry.first_name,
      last_name: entry.last_name,
      role: entry.role,
      merchant_id: entry.merchant_id,
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw new Error(`profile upsert failed for ${entry.email}: ${error.message}`)
  }
}

async function syncCommand(dryRun) {
  const { data: entries, error } = await admin
    .from('portal_access')
    .select('id, email, first_name, last_name, role, merchant_id, active, user_id')
    .order('email')

  if (error) {
    throw new Error(`Cannot read portal_access: ${error.message}`)
  }

  const authUsers = await listAuthUsersByEmail()
  const allowed = new Set(entries.filter((e) => e.active).map((e) => e.email.toLowerCase()))
  const credentials = []
  let created = 0
  let updated = 0
  let revoked = 0

  for (const entry of entries) {
    const email = entry.email.toLowerCase()
    const existing = authUsers.get(email)

    if (!entry.active) {
      if (existing && !existing.banned_until) {
        console.log(`[revoke] ${email}`)
        if (!dryRun) {
          const { error: banError } = await admin.auth.admin.updateUserById(existing.id, {
            ban_duration: BAN_FOREVER,
          })
          if (banError) {
            console.error(`  ! ${banError.message}`)
            continue
          }
        }
        revoked += 1
      }
      continue
    }

    if (!existing) {
      console.log(`[create] ${email} (${entry.role})`)
      if (dryRun) {
        created += 1
        continue
      }

      const password = generatePassword()
      const { data, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      })

      if (createError) {
        console.error(`  ! ${createError.message}`)
        continue
      }

      await upsertProfile(entry, data.user.id)
      await admin
        .from('portal_access')
        .update({ user_id: data.user.id, provisioned_at: new Date().toISOString() })
        .eq('id', entry.id)

      credentials.push({ email, password })
      created += 1
      continue
    }

    // Account exists: make sure it is unbanned and linked, but never touch its password.
    if (!dryRun) {
      if (existing.banned_until) {
        await admin.auth.admin.updateUserById(existing.id, { ban_duration: 'none' })
      }
      await upsertProfile(entry, existing.id)
      if (entry.user_id !== existing.id) {
        await admin
          .from('portal_access')
          .update({ user_id: existing.id, provisioned_at: entry.provisioned_at ?? new Date().toISOString() })
          .eq('id', entry.id)
      }
    }
    updated += 1
  }

  const orphans = [...authUsers.keys()].filter((email) => !allowed.has(email))
  if (orphans.length > 0) {
    console.log('\nAuth users absent from the allowlist (review manually):')
    for (const email of orphans) {
      console.log(`  - ${email}`)
    }
  }

  const credentialsPath = writeCredentialsFile(credentials)
  if (credentialsPath) {
    console.log(`\nProvisional passwords written to ${credentialsPath}`)
    console.log('Distribute them, then delete this file. It is the only copy.')
  }

  console.log(`\ncreated=${created} linked=${updated} revoked=${revoked}${dryRun ? ' (dry-run)' : ''}`)
}

async function resetCommand(rawEmail) {
  const email = rawEmail.trim().toLowerCase()
  const authUsers = await listAuthUsersByEmail()
  const user = authUsers.get(email)

  if (!user) {
    throw new Error(`No auth user for ${email}`)
  }

  const { data: entry, error } = await admin
    .from('portal_access')
    .select('id, active')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new Error(`Cannot read portal_access: ${error.message}`)
  }
  if (!entry || !entry.active) {
    throw new Error(`${email} is not an active allowlist entry`)
  }

  const password = generatePassword()
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: { ...user.user_metadata, must_change_password: true },
  })

  if (updateError) {
    throw new Error(updateError.message)
  }

  console.log(`New provisional password for ${email}: ${password}`)
  console.log('Change forced on next login.')
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  if (lines.length === 0) {
    return []
  }

  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] === '' || cells[index] === undefined ? null : cells[index]
    })
    return row
  })
}

async function loadMerchantIndex() {
  const { data, error } = await admin
    .from('merchants')
    .select('id, legal_name, trade_name, hall_id, halls(name)')

  if (error) {
    throw new Error(`Cannot read merchants: ${error.message}`)
  }

  const byKey = new Map()
  for (const merchant of data) {
    const hall = Array.isArray(merchant.halls) ? merchant.halls[0] : merchant.halls
    const hallName = (hall?.name ?? '').toLowerCase().trim()

    for (const name of [merchant.legal_name, merchant.trade_name]) {
      if (!name) {
        continue
      }
      const key = name.toLowerCase().trim()
      byKey.set(key, merchant)
      byKey.set(`${hallName}|${key}`, merchant)
    }
  }

  return byKey
}

async function importCommand(filePath) {
  const rows = parseCsv(readFileSync(filePath, 'utf8'))
  if (rows.length === 0) {
    throw new Error('CSV is empty')
  }

  const merchantIndex = await loadMerchantIndex()
  const errors = []

  const payload = rows.map((row, index) => {
    const line = index + 2
    if (!row.email) {
      errors.push(`line ${line}: missing email`)
      return null
    }

    const role = row.role || 'merchant'
    let merchantId = row.merchant_id
    let hallId = row.hall_id

    if (!merchantId && row.merchant_name) {
      const hallKey = (row.hall_name ?? '').toLowerCase().trim()
      const merchant =
        merchantIndex.get(`${hallKey}|${row.merchant_name.toLowerCase().trim()}`) ??
        merchantIndex.get(row.merchant_name.toLowerCase().trim())

      if (!merchant) {
        errors.push(`line ${line}: unknown merchant "${row.merchant_name}"`)
        return null
      }

      merchantId = merchant.id
      hallId = hallId ?? merchant.hall_id
    }

    if (role === 'merchant' && !merchantId) {
      errors.push(`line ${line}: merchant_id or merchant_name is required`)
      return null
    }

    return {
      email: row.email.toLowerCase(),
      first_name: row.first_name,
      last_name: row.last_name,
      role,
      merchant_id: merchantId,
      hall_id: hallId,
      active: true,
    }
  })

  if (errors.length > 0) {
    throw new Error(`Import aborted:\n  ${errors.join('\n  ')}`)
  }

  const { error } = await admin.from('portal_access').upsert(payload, { onConflict: 'email' })
  if (error) {
    throw new Error(`Import failed: ${error.message}`)
  }

  console.log(`Imported ${payload.length} allowlist entries. Run "sync" to provision the accounts.`)
}

async function main() {
  const [command = 'sync', ...args] = process.argv.slice(2)

  switch (command) {
    case 'sync':
      await syncCommand(args.includes('--dry-run'))
      break
    case 'reset':
      if (!args[0]) {
        throw new Error('Usage: reset <email>')
      }
      await resetCommand(args[0])
      break
    case 'import':
      if (!args[0]) {
        throw new Error('Usage: import <file.csv>')
      }
      await importCommand(args[0])
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
