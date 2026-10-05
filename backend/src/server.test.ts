import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Config } from './config.js'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'
import { createServer } from './server.js'

const INTERNAL_TOKEN = 'x'.repeat(40)

const config = {
  supabase: { url: 'https://project.supabase.co', serviceRoleKey: 'key' },
  pennylane: { apiKey: '', apiUrl: '' },
  server: { port: 0, nodeEnv: 'development', internalApiToken: INTERNAL_TOKEN, allowedOrigins: ['https://portal.test'], trustProxyHops: 0 },
  biltoki: { hallsToSync: ['hall-1'], syncCronSchedule: '0 2 * * *' },
  logging: { level: 'error' },
} as unknown as Config

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

/** A database whose auth lookup fails, to exercise the error paths. */
function brokenDb(): SupabaseAdmin {
  return {
    auth: {
      getUser: async () => {
        throw new Error('supabase unreachable')
      },
    },
  } as unknown as SupabaseAdmin
}

/** A database where every bearer token belongs to an active super admin. */
function superAdminDb(): SupabaseAdmin {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: { id: 'x', role: 'super_admin' }, error: null }),
  }
  return {
    from: () => chain,
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c', app_metadata: {} } }, error: null }) },
  } as unknown as SupabaseAdmin
}

let close: (() => void) | undefined

async function start(db: SupabaseAdmin): Promise<string> {
  const server = createServer(config, db, logger).listen(0)
  close = () => server.close()
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(() => close?.())

describe('API error handling', () => {
  it('answers a malformed JSON body with a JSON 400 and no stack trace', async () => {
    const base = await start(brokenDb())

    const response = await fetch(`${base}/api/account/password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('turns a failing authentication lookup into a 500 instead of hanging', async () => {
    const base = await start(brokenDb())

    const response = await fetch(`${base}/api/service-charges/anything/document`, {
      headers: { authorization: 'Bearer token' },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  })

  it('rejects a charge identifier that is not a UUID', async () => {
    const base = await start(superAdminDb())

    const response = await fetch(`${base}/api/service-charges/not-a-uuid/document`, {
      headers: { authorization: 'Bearer token' },
    })

    expect(response.status).toBe(400)
  })
})

describe('API access control', () => {
  it('requires credentials on /api', async () => {
    const base = await start(brokenDb())

    expect((await fetch(`${base}/api/halls`)).status).toBe(401)
    expect((await fetch(`${base}/api/halls`, { headers: { 'x-internal-token': 'wrong' } })).status).toBe(403)
    expect((await fetch(`${base}/api/halls`, { headers: { 'x-internal-token': INTERNAL_TOKEN } })).status).toBe(200)
  })

  it('only grants CORS headers to configured origins', async () => {
    const base = await start(brokenDb())

    const allowed = await fetch(`${base}/health`, { headers: { origin: 'https://portal.test' } })
    const other = await fetch(`${base}/health`, { headers: { origin: 'https://evil.test' } })

    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://portal.test')
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('limits the request rate on /api but not on health probes', async () => {
    const base = await start(brokenDb())
    const statuses: number[] = []

    for (let i = 0; i < 305; i += 1) {
      statuses.push((await fetch(`${base}/api/halls`)).status)
    }

    expect(statuses[statuses.length - 1]).toBe(429)
    expect((await fetch(`${base}/health`)).status).toBe(200)
  })
})
