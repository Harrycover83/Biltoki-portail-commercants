import { describe, expect, it, vi } from 'vitest'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { validatePassword } from './password-policy.js'
import { generatePassword, UserAdminService, type Actor } from './users.service.js'
import type { UserInput } from './user-input.js'

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger
const admin: Actor = { id: 'admin-1', email: 'admin@biltoki.test' }

const input: UserInput = {
  email: 'manager@biltoki.test',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'hall_manager',
  jobTitle: null,
  merchantId: null,
  hallIds: ['11111111-1111-1111-1111-111111111111'],
}

function fakeDb(options: { rpcError?: { message: string; code?: string } } = {}) {
  const insertedAudit: unknown[] = []
  const auth = {
    createUser: vi.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null })),
    deleteUser: vi.fn(async () => ({ error: null })),
  }
  const accessRow = {
    email: admin.email,
    first_name: 'Ada',
    last_name: 'Admin',
    role: 'super_admin',
    job_title: null,
    merchant_id: null,
    active: true,
    user_id: admin.id,
  }
  const makeChain = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: table === 'portal_access' ? accessRow : null, error: null }),
      insert: async (row: unknown) => {
        insertedAudit.push(row)
        return { error: null }
      },
    }
    return chain
  }
  const db = {
    auth: { admin: auth },
    rpc: vi.fn(async () => ({ error: options.rpcError ?? null })),
    from: makeChain,
  } as unknown as SupabaseAdmin
  return { db, auth, insertedAudit }
}

describe('generatePassword', () => {
  it('always satisfies the password policy', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(validatePassword(generatePassword())).toBeNull()
    }
  })

  it('does not repeat itself', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()))
    expect(passwords.size).toBe(50)
  })
})

describe('UserAdminService.createUser', () => {
  it('creates the auth user with a forced password change and audits the action', async () => {
    const { db, auth, insertedAudit } = fakeDb()

    const result = await new UserAdminService(db, logger).createUser(input, admin)

    expect(result.userId).toBe('new-user')
    expect(validatePassword(result.provisionalPassword)).toBeNull()
    expect(auth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: input.email, app_metadata: { must_change_password: true } }),
    )
    expect(insertedAudit[0]).toMatchObject({ action: 'user.create', target_email: input.email })
  })

  it('removes the auth user again when the access rules are rejected', async () => {
    const { db, auth } = fakeDb({ rpcError: { message: 'hall_manager needs exactly one hall', code: '23514' } })

    await expect(new UserAdminService(db, logger).createUser(input, admin)).rejects.toMatchObject({
      status: 400,
    })
    expect(auth.deleteUser).toHaveBeenCalledWith('new-user')
  })
})

describe('UserAdminService self-protection', () => {
  it('never lets an administrator deactivate, delete or demote themselves', async () => {
    const { db } = fakeDb()
    const service = new UserAdminService(db, logger)

    await expect(service.setActive(admin.id!, false, admin)).rejects.toThrow('propre compte')
    await expect(service.deleteUser(admin.id!, admin)).rejects.toThrow('propre compte')
    await expect(service.updateUser(admin.id!, { ...input, role: 'hq', hallIds: [] }, admin)).rejects.toThrow(
      'propre role',
    )
  })
})
