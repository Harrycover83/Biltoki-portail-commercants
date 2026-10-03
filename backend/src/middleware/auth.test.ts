import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { requirePortalUser, requireStaffForHall } from './auth.js'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'

const HALL_OK = '11111111-1111-1111-1111-111111111111'
const HALL_OTHER = '22222222-2222-2222-2222-222222222222'

function fakeDb(role: string, scopedHalls: string[] = [], appMetadata: Record<string, unknown> = {}): SupabaseAdmin {
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
  return {
    from,
    auth: {
      getUser: async () => ({
        data: { user: { id: 'u1', email: 'a@b.c', app_metadata: appMetadata } },
        error: null,
      }),
    },
  } as unknown as SupabaseAdmin
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

  it('lets hall managers, network managers and the super admin sync, but not head office', async () => {
    for (const role of ['hall_manager', 'network_manager']) {
      expect((await run(fakeDb(role, [HALL_OK]), HALL_OK)).next).toHaveBeenCalled()
    }
    expect((await run(fakeDb('super_admin'), HALL_OTHER)).next).toHaveBeenCalled()

    const hq = await run(fakeDb('hq'), HALL_OK)
    expect(hq.next).not.toHaveBeenCalled()
    expect(hq.status).toHaveBeenCalledWith(403)
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

  it('locks accounts that still have to change their provisional password', async () => {
    const result = await run(fakeDb('super_admin', [], { must_change_password: true }), HALL_OK)
    expect(result.next).not.toHaveBeenCalled()
    expect(result.status).toHaveBeenCalledWith(403)
  })
})

describe('requirePortalUser and the forced password change', () => {
  async function guard(db: SupabaseAdmin, allowPending: boolean) {
    const status = vi.fn().mockReturnThis()
    const json = vi.fn()
    const res = { status, json, locals: {} } as unknown as Response
    const next = vi.fn()
    const req = {
      params: {},
      method: 'POST',
      path: '/password',
      ip: '1.1.1.1',
      header: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer t' : undefined),
    } as unknown as Request
    await requirePortalUser(config, db, logger, { allowPasswordChangePending: allowPending })(req, res, next)
    return { next, status, json }
  }

  it('refuses a locked account everywhere except on the password route', async () => {
    const db = fakeDb('merchant', [], { must_change_password: true })

    const blocked = await guard(db, false)
    expect(blocked.next).not.toHaveBeenCalled()
    expect(blocked.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'password_change_required' }))

    expect((await guard(db, true)).next).toHaveBeenCalled()
  })

  it('lets an unlocked account through', async () => {
    expect((await guard(fakeDb('merchant', [], { must_change_password: false }), false)).next).toHaveBeenCalled()
  })
})
