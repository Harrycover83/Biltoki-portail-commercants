import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Config } from './config.js'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'
import { createServer } from './server.js'
import { PopinaClient } from './integrations/popina/client.js'

const INTERNAL_TOKEN = 'x'.repeat(40)

const config = {
  supabase: { url: 'https://project.supabase.co', serviceRoleKey: 'key' },
  pennylane: { apiKey: '', apiUrl: '' },
  popina: { apiKey: 'test-key', hallId: '29a1b758-07c9-481e-bd54-c72b6a9949c4', locationId: 'toulon' },
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
function superAdminDb(role = 'super_admin', permitted = true): SupabaseAdmin {
  const filters: Record<string, unknown> = {}
  const chain = {
    select: () => chain,
    eq: (name: string, value: unknown) => { filters[name] = value; return chain },
    maybeSingle: async () => ({
      data: filters.profile_id && !permitted ? null : { id: 'x', role }, error: null,
    }),
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

afterEach(() => { close?.(); vi.restoreAllMocks() })

describe('Popina staff-only revenue', () => {
  const path = '/api/popina/29a1b758-07c9-481e-bd54-c72b6a9949c4/revenue?since=2025-10-01&until=2025-10-02'
  const headers = { authorization: 'Bearer test-user' }

  it('requires a portal session, never just the internal token', async () => {
    const base = await start(brokenDb())
    expect((await fetch(`${base}${path}`)).status).toBe(401)
    expect((await fetch(`${base}${path}`, { headers: { 'x-internal-token': INTERNAL_TOKEN } })).status).toBe(401)
  })

  it.each(['merchant', 'hall_manager', 'network_manager'])('denies %s outside its staff scope', async (role) => {
    const upstream = vi.spyOn(PopinaClient.prototype, 'getReports').mockResolvedValue([])
    const base = await start(superAdminDb(role, false))
    expect((await fetch(`${base}${path}`, { headers })).status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })

  it.each(['hq', 'super_admin', 'hall_manager', 'network_manager'])('allows %s to read its hall', async (role) => {
    const upstream = vi.spyOn(PopinaClient.prototype, 'getReports').mockResolvedValue([])
    const base = await start(superAdminDb(role))
    const response = await fetch(`${base}${path}`, { headers })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({ totalCurrentCents: null, trendPercent: null, comparableDays: 0 })
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(upstream.mock.calls[1]).toEqual(['2024-09-30', '2024-10-03', 'toulon'])
  })

  it('does not use the Toulon key for another hall', async () => {
    const upstream = vi.spyOn(PopinaClient.prototype, 'getReports').mockResolvedValue([])
    const base = await start(superAdminDb('hq'))
    expect((await fetch(`${base}${path.replace(config.popina.hallId, '11111111-1111-1111-1111-111111111111')}`, { headers })).status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('validates periods before calling Popina and surfaces upstream failures', async () => {
    const upstream = vi.spyOn(PopinaClient.prototype, 'getReports').mockRejectedValue(new Error('Upstream unavailable'))
    const base = await start(superAdminDb())
    expect((await fetch(`${base}${path.replace('2025-10-01', '2025-02-30')}`, { headers })).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
    expect((await fetch(`${base}${path}`, { headers })).status).toBe(502)
  })
})

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
