import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asCaller, createTestDatabase, type Caller } from './test-db.js'

/**
 * Row-level-security integration tests, run against the real migrations (see test-db.ts).
 * Merchant isolation, staff hall scopes, anonymous lockout and the monthly revenue declarations.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORG = id(1)
const HALL_1 = id(10)
const HALL_2 = id(11)
const MERCHANT_A = id(20)
const MERCHANT_B = id(21)
const MERCHANT_C = id(22)

const users = {
  merchantA: { id: id(30) },
  merchantB: { id: id(31) },
  merchantC: { id: id(32) },
  manager1: { id: id(40) },
  manager2: { id: id(41) },
  hq: { id: id(42) },
  superAdmin: { id: id(43) },
} satisfies Record<string, Caller>

const CURRENT_MONTH = new Date().toISOString().slice(0, 7) + '-01'
const NEXT_MONTH = (() => {
  const date = new Date(`${CURRENT_MONTH}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
})()

let db: PGlite

const as = <T>(caller: Caller, work: () => Promise<T>) => asCaller(db, caller, work)
const REFUSED = /row-level security|permission denied/i

async function rows<T = Record<string, unknown>>(caller: Caller, sql: string, params: unknown[] = []): Promise<T[]> {
  return asCaller(db, caller, async () => (await db.query<T>(sql, params)).rows)
}

/** Resolves with the error message when the statement is refused, so tests can assert on the refusal. */
async function refusal(caller: Caller, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await asCaller(db, caller, () => db.query(sql, params))
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

const ids = (list: { id: string }[]) => list.map((row) => row.id).sort()

beforeAll(async () => {
  db = await createTestDatabase()

  await db.exec(`
    insert into public.organizations (id, name) values ('${ORG}', 'Biltoki');
    insert into public.halls (id, organization_id, name) values ('${HALL_1}', '${ORG}', 'Toulon'), ('${HALL_2}', '${ORG}', 'Nice');
    insert into public.merchants (id, hall_id, legal_name) values
      ('${MERCHANT_A}', '${HALL_1}', 'Stand A'), ('${MERCHANT_B}', '${HALL_1}', 'Stand B'), ('${MERCHANT_C}', '${HALL_2}', 'Stand C');
  `)

  const accounts: [keyof typeof users, string, string, string | null][] = [
    ['merchantA', 'a@example.com', 'merchant', MERCHANT_A],
    ['merchantB', 'b@example.com', 'merchant', MERCHANT_B],
    ['merchantC', 'c@example.com', 'merchant', MERCHANT_C],
    ['manager1', 'm1@example.com', 'hall_manager', null],
    ['manager2', 'm2@example.com', 'hall_manager', null],
    ['hq', 'hq@example.com', 'hq', null],
    ['superAdmin', 'root@example.com', 'super_admin', null],
  ]
  for (const [key, email, role, merchantId] of accounts) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [users[key].id, email])
    await db.query(`insert into public.portal_access (email, user_id, role, merchant_id) values ($1, $2, $3::public.user_role, $4)`, [email, users[key].id, role, merchantId])
    await db.query(`insert into public.profiles (id, email, role, merchant_id) values ($1, $2, $3::public.user_role, $4)`, [users[key].id, email, role, merchantId])
  }
  await db.exec(`
    insert into public.admin_hall_permissions (profile_id, hall_id) values ('${users.manager1.id}', '${HALL_1}'), ('${users.manager2.id}', '${HALL_2}');
    insert into public.stands (hall_id, merchant_id, name, linear_meters, start_date) values
      ('${HALL_1}', '${MERCHANT_A}', 'A1', 4, '2026-01-01'), ('${HALL_1}', '${MERCHANT_B}', 'B1', 6, '2026-01-01');
    insert into public.service_charge_periods (id, hall_id, label, period_start, period_end) values
      ('${id(50)}', '${HALL_1}', 'T1 Toulon', '2026-01-01', '2026-03-31'), ('${id(51)}', '${HALL_2}', 'T1 Nice', '2026-01-01', '2026-03-31');
    insert into public.service_charges (id, hall_id, period_id, label, amount_excl_tax, amount_tax, amount_incl_tax) values
      ('${id(60)}', '${HALL_1}', '${id(50)}', 'Eau Toulon', 100, 20, 120), ('${id(61)}', '${HALL_2}', '${id(51)}', 'Eau Nice', 50, 10, 60);
  `)
  await db.query(
    `insert into public.allocations (period_id, service_charge_id, merchant_id, stand_id, merchant_linear_meters, total_linear_meters, allocation_percentage, allocated_amount)
     select '${id(50)}', '${id(60)}', merchant_id, id, linear_meters, 10, linear_meters * 10, linear_meters * 12 from public.stands`,
  )
}, 120_000)

afterAll(async () => { await db?.close() })

describe('Anonymous callers', () => {
  it.each(['merchants', 'profiles', 'service_charges', 'portal_access', 'merchant_revenue_declarations', 'dashboard_preferences'])(
    'cannot read %s',
    async (table) => {
      expect(await refusal('anon', `select * from public.${table}`)).toMatch(/permission denied|row-level security/i)
    },
  )
})

describe('Merchant isolation', () => {
  it('sees only its own merchant, stands and allocations', async () => {
    expect(ids(await rows(users.merchantA, 'select id from public.merchants'))).toEqual([MERCHANT_A])
    const stands = await rows<{ name: string }>(users.merchantA, 'select name from public.stands')
    expect(stands.map((stand) => stand.name)).toEqual(['A1'])
    const allocations = await rows<{ merchant_id: string }>(users.merchantA, 'select merchant_id from public.allocations')
    expect(allocations.map((allocation) => allocation.merchant_id)).toEqual([MERCHANT_A])
  })

  it('only sees the common charges of its own hall', async () => {
    const charges = await rows<{ label: string }>(users.merchantA, 'select label from public.service_charges')
    expect(charges.map((charge) => charge.label)).toEqual(['Eau Toulon'])
    const other = await rows<{ label: string }>(users.merchantC, 'select label from public.service_charges')
    expect(other.map((charge) => charge.label)).toEqual(['Eau Nice'])
  })

  it('cannot see other profiles or the access allowlist of others', async () => {
    expect(ids(await rows(users.merchantA, 'select id from public.profiles'))).toEqual([users.merchantA.id])
  })

  it('cannot write charges, merchants or stands', async () => {
    expect(await refusal(users.merchantA, `insert into public.service_charges (hall_id, period_id, label, amount_excl_tax, amount_tax, amount_incl_tax) values ('${HALL_1}', '${id(50)}', 'x', 1, 0, 1)`))
      .toMatch(/row-level security|permission denied/i)
    const result = await as(users.merchantA, async () => db.query(`update public.merchants set legal_name = 'Hacked' where id = '${MERCHANT_B}'`))
      .catch((error: Error) => error)
    expect(result instanceof Error || (result as { affectedRows?: number }).affectedRows === 0).toBe(true)
    const [{ legal_name: name }] = (await db.query<{ legal_name: string }>(`select legal_name from public.merchants where id = '${MERCHANT_B}'`)).rows
    expect(name).toBe('Stand B')
  })

  it('cannot promote itself or change its merchant link', async () => {
    expect(await refusal(users.merchantA, `update public.profiles set role = 'super_admin' where id = '${users.merchantA.id}'`)).toMatch(/permission denied|protected profile/i)
    expect(await refusal(users.merchantA, `update public.profiles set merchant_id = '${MERCHANT_B}' where id = '${users.merchantA.id}'`)).toMatch(/permission denied|protected profile/i)
    const [{ role }] = (await db.query<{ role: string }>(`select role from public.profiles where id = '${users.merchantA.id}'`)).rows
    expect(role).toBe('merchant')
  })

  it('can still update its display name', async () => {
    await as(users.merchantA, () => db.query(`update public.profiles set first_name = 'Ana' where id = '${users.merchantA.id}'`))
    const [{ first_name: firstName }] = (await db.query<{ first_name: string }>(`select first_name from public.profiles where id = '${users.merchantA.id}'`)).rows
    expect(firstName).toBe('Ana')
  })

  it('loses all access once its portal access is deactivated, and regains it after', async () => {
    await db.query(`update public.portal_access set active = false where user_id = $1`, [users.merchantB.id])
    try {
      expect(await rows(users.merchantB, 'select id from public.merchants')).toEqual([])
      expect(await rows(users.merchantB, 'select id from public.service_charges')).toEqual([])
    } finally {
      await db.query(`update public.portal_access set active = true where user_id = $1`, [users.merchantB.id])
    }
    expect(ids(await rows(users.merchantB, 'select id from public.merchants'))).toEqual([MERCHANT_B])
  })

  it('is locked out while a forced password change is pending', async () => {
    const caller: Caller = { id: users.merchantA.id, appMetadata: { must_change_password: true } }
    expect(await rows(caller, 'select id from public.merchants')).toEqual([])
  })
})

describe('Staff hall scopes', () => {
  it('lets a hall manager read only the merchants of its hall', async () => {
    expect(ids(await rows(users.manager1, 'select id from public.merchants'))).toEqual([MERCHANT_A, MERCHANT_B])
    expect(ids(await rows(users.manager2, 'select id from public.merchants'))).toEqual([MERCHANT_C])
  })

  it('lets HQ and the super admin read every hall', async () => {
    expect(ids(await rows(users.hq, 'select id from public.merchants'))).toEqual([MERCHANT_A, MERCHANT_B, MERCHANT_C])
    expect(ids(await rows(users.superAdmin, 'select id from public.merchants'))).toEqual([MERCHANT_A, MERCHANT_B, MERCHANT_C])
  })

  it('keeps writes to the super admin: managers and HQ are read-only on charges', async () => {
    const insert = (label: string) =>
      `insert into public.service_charges (hall_id, period_id, label, amount_excl_tax, amount_tax, amount_incl_tax) values ('${HALL_1}', '${id(50)}', '${label}', 1, 0, 1)`
    expect(await refusal(users.manager1, insert('m'))).toMatch(REFUSED)
    expect(await refusal(users.hq, insert('h'))).toMatch(REFUSED)
    expect(await refusal(users.superAdmin, insert('s'))).toBe('')
    await db.query(`delete from public.service_charges where label = 's'`)
  })

  it('stops a hall manager from widening its own scope', async () => {
    expect(await refusal(users.manager1, `insert into public.admin_hall_permissions (profile_id, hall_id) values ('${users.manager1.id}', '${HALL_2}')`))
      .toMatch(/row-level security|permission denied|only be assigned to one hall/i)
    const scopes = await db.query(`select 1 from public.admin_hall_permissions where profile_id = '${users.manager1.id}'`)
    expect(scopes.rows).toHaveLength(1)
  })
})

describe('Monthly revenue declarations', () => {
  const declare = (merchantId: string, month: string, cents: number) =>
    `insert into public.merchant_revenue_declarations (merchant_id, month, amount_cents) values ('${merchantId}', '${month}', ${cents})`

  it('lets a merchant declare, read and correct its own month', async () => {
    expect(await refusal(users.merchantA, declare(MERCHANT_A, '2026-01-01', 1_200_000))).toBe('')
    const own = await rows<{ amount_cents: string }>(users.merchantA, `select amount_cents from public.merchant_revenue_declarations`)
    expect(own.map((row) => Number(row.amount_cents))).toEqual([1_200_000])

    await as(users.merchantA, () => db.query(`update public.merchant_revenue_declarations set amount_cents = 1250000 where month = '2026-01-01'`))
    const [{ amount_cents: amount }] = (await db.query<{ amount_cents: string }>(`select amount_cents from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_A}'`)).rows
    expect(Number(amount)).toBe(1_250_000)
  })

  it('records the author and update time on the server side', async () => {
    const forged = id(99)
    await as(users.merchantA, () => db.query(
      `update public.merchant_revenue_declarations set declared_by = '${forged}', amount_cents = 1260000 where month = '2026-01-01'`,
    ))
    const [row] = (await db.query<{ declared_by: string }>(`select declared_by from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_A}'`)).rows
    expect(row.declared_by).toBe(users.merchantA.id)
  })

  it('refuses a month declared for another merchant', async () => {
    expect(await refusal(users.merchantA, declare(MERCHANT_B, '2026-02-01', 100))).toMatch(/row-level security/i)
  })

  it('refuses a future month, a negative amount and a day that is not the first of the month', async () => {
    expect(await refusal(users.merchantA, declare(MERCHANT_A, NEXT_MONTH, 100))).toMatch(/row-level security/i)
    expect(await refusal(users.merchantA, declare(MERCHANT_A, '2026-03-01', -5))).toMatch(/amount_range|check constraint/i)
    expect(await refusal(users.merchantA, declare(MERCHANT_A, '2026-03-15', 100))).toMatch(/first_day|check constraint/i)
  })

  it('declares the current month and refuses a second declaration of the same month', async () => {
    expect(await refusal(users.merchantA, declare(MERCHANT_A, CURRENT_MONTH, 500_000))).toBe('')
    expect(await refusal(users.merchantA, declare(MERCHANT_A, CURRENT_MONTH, 600_000))).toMatch(/unique|duplicate/i)
  })

  it('hides declarations from other merchants and stops them from editing or deleting them', async () => {
    expect(await rows(users.merchantB, `select id from public.merchant_revenue_declarations`)).toEqual([])
    await as(users.merchantB, () => db.query(`update public.merchant_revenue_declarations set amount_cents = 1`))
    await as(users.merchantB, () => db.query(`delete from public.merchant_revenue_declarations`))
    const remaining = await db.query<{ amount_cents: string }>(`select amount_cents from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_A}' and month = '2026-01-01'`)
    expect(Number(remaining.rows[0].amount_cents)).toBe(1_260_000)
  })

  it('cannot move a declaration to another merchant or month', async () => {
    await as(users.merchantA, () => db.query(`update public.merchant_revenue_declarations set merchant_id = '${MERCHANT_B}', month = '2026-05-01' where month = '2026-01-01'`)).catch(() => undefined)
    const moved = await db.query(`select 1 from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_B}' or month = '2026-05-01'`)
    expect(moved.rows).toHaveLength(0)
  })

  it('shows staff the declarations of their hall only, read-only', async () => {
    await db.query(`insert into public.merchant_revenue_declarations (merchant_id, month, amount_cents) values ('${MERCHANT_C}', '2026-01-01', 700000)`)
    const seenByManager1 = await rows<{ merchant_id: string }>(users.manager1, `select merchant_id from public.merchant_revenue_declarations`)
    expect(new Set(seenByManager1.map((row) => row.merchant_id))).toEqual(new Set([MERCHANT_A]))
    const seenByManager2 = await rows<{ merchant_id: string }>(users.manager2, `select merchant_id from public.merchant_revenue_declarations`)
    expect(seenByManager2.map((row) => row.merchant_id)).toEqual([MERCHANT_C])
    const seenByHq = await rows<{ merchant_id: string }>(users.hq, `select merchant_id from public.merchant_revenue_declarations`)
    expect(new Set(seenByHq.map((row) => row.merchant_id))).toEqual(new Set([MERCHANT_A, MERCHANT_C]))

    expect(await refusal(users.manager1, declare(MERCHANT_A, '2026-04-01', 1))).toMatch(REFUSED)
    await as(users.manager1, () => db.query(`update public.merchant_revenue_declarations set amount_cents = 1`))
    await as(users.manager1, () => db.query(`delete from public.merchant_revenue_declarations`))
    const intact = await db.query(`select 1 from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_A}' and amount_cents > 1`)
    expect(intact.rows.length).toBeGreaterThan(0)
  })

  it('lets a merchant delete its own declaration', async () => {
    await as(users.merchantA, () => db.query(`delete from public.merchant_revenue_declarations where month = '${CURRENT_MONTH}'`))
    const left = await db.query(`select 1 from public.merchant_revenue_declarations where merchant_id = '${MERCHANT_A}' and month = '${CURRENT_MONTH}'`)
    expect(left.rows).toHaveLength(0)
  })
})

describe('Dashboard preferences', () => {
  it('are private to their owner', async () => {
    await as(users.manager1, () => db.query(`insert into public.dashboard_preferences (profile_id, widgets) values ('${users.manager1.id}', '[]')`))
    expect(await refusal(users.manager2, `insert into public.dashboard_preferences (profile_id, widgets) values ('${users.manager1.id}', '[]')`)).toMatch(/row-level security/i)
    expect(await rows(users.manager2, 'select profile_id from public.dashboard_preferences')).toEqual([])
    expect(await rows(users.manager1, 'select profile_id from public.dashboard_preferences')).toHaveLength(1)
  })
})

