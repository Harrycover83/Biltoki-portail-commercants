import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { requireStaffForHall } from './auth.js'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'

const HALL_OK = '11111111-1111-1111-1111-111111111111'
const HALL_OTHER = '22222222-2222-2222-2222-222222222222'

function fakeDb(role: string, scopedHalls: string[] = []): SupabaseAdmin {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {}
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters[column] = value
        return chain
      },
      maybeSingle: async () => {
        if (table === 'profiles') return { data: { role }, error: null }
        if (table === 'portal_access') return { data: { id: 'pa' }, error: null }
        if (table === 'admin_hall_permissions') {
          return { data: scopedHalls.includes(filters.hall_id as string) ? { id: 'p' } : null, error: null }
        }
        return { data: null, error: null }
      },
    }
    return chain
  }
  return { from, auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }) } } as unknown as SupabaseAdmin
}

const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as Logger
const config = { server: { internalApiToken: 'x'.repeat(40) } } as unknown as Config

async function run(db: SupabaseAdmin, hallId: string, headers: Record<string, string> = { authorization: 'Bearer t' }) {
  const status = vi.fn().mockReturnThis()
  const res = { status, json: vi.fn(), locals: {} } as unknown as Response
  const next = vi.fn()
  const req = {
    params: { hallId },
    method: 'POST',
    path: '/x',
    ip: '1.1.1.1',
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request
  await requireStaffForHall(config, db, logger)(req, res, next)
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { next, status }
}

describe('requireStaffForHall', () => {
  it('lets a hall manager sync its own hall only', async () => {
    const db = fakeDb('hall_manager', [HALL_OK])
    expect((await run(db, HALL_OK)).next).toHaveBeenCalled()

    const denied = await run(db, HALL_OTHER)
    expect(denied.next).not.toHaveBeenCalled()
    expect(denied.status).toHaveBeenCalledWith(403)
  })

  it('lets head office and super admin sync any hall', async () => {
    for (const role of ['hq', 'super_admin']) {
      expect((await run(fakeDb(role), HALL_OTHER)).next).toHaveBeenCalled()
    }
  })

  it('never lets a merchant trigger a sync', async () => {
    const result = await run(fakeDb('merchant', [HALL_OK]), HALL_OK)
    expect(result.next).not.toHaveBeenCalled()
    expect(result.status).toHaveBeenCalledWith(403)
  })

  it('accepts the ops token and rejects a wrong one', async () => {
    const ok = await run(fakeDb('merchant'), HALL_OK, { 'x-internal-token': 'x'.repeat(40) })
    expect(ok.next).toHaveBeenCalled()

    const bad = await run(fakeDb('super_admin'), HALL_OK, { 'x-internal-token': 'nope' })
    expect(bad.next).not.toHaveBeenCalled()
    expect(bad.status).toHaveBeenCalledWith(403)
  })

  it('rejects requests without a bearer token', async () => {
    const result = await run(fakeDb('super_admin'), HALL_OK, {})
    expect(result.next).not.toHaveBeenCalled()
    expect(result.status).toHaveBeenCalledWith(401)
  })
})
