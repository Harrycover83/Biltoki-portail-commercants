import { describe, expect, it } from 'vitest'
import { validateUserInput } from './user-input.js'
import { generatePassword } from './users.service.js'
import { isGlobalRole, isHallScopedRole, isStaffRole } from '../auth/roles.js'

const HALL_A = '11111111-1111-1111-1111-111111111111'
const HALL_B = '22222222-2222-2222-2222-222222222222'
const MERCHANT = 'a1111111-1111-1111-1111-111111111111'

const base = { email: ' Jean.Dupont@Biltoki.fr ', firstName: 'Jean', lastName: 'Dupont' }

describe('validateUserInput', () => {
  it('accepts a hall manager bound to exactly one hall and normalizes the e-mail', () => {
    const result = validateUserInput(
      { ...base, role: 'hall_manager', jobTitle: 'Capitaine', hallIds: [HALL_A] },
      { requireEmail: true },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.email).toBe('jean.dupont@biltoki.fr')
      expect(result.value.hallIds).toEqual([HALL_A])
    }
  })

  it('rejects a hall manager with zero or several halls', () => {
    expect(validateUserInput({ ...base, role: 'hall_manager', hallIds: [] }, { requireEmail: true }).ok).toBe(false)
    expect(
      validateUserInput({ ...base, role: 'hall_manager', hallIds: [HALL_A, HALL_B] }, { requireEmail: true }).ok,
    ).toBe(false)
  })

  it('requires at least one hall for a network manager and de-duplicates them', () => {
    expect(validateUserInput({ ...base, role: 'network_manager', hallIds: [] }, { requireEmail: true }).ok).toBe(false)
    const result = validateUserInput(
      { ...base, role: 'network_manager', hallIds: [HALL_A, HALL_B, HALL_A] },
      { requireEmail: true },
    )
    expect(result.ok && result.value.hallIds).toEqual([HALL_A, HALL_B])
  })

  it('refuses hall scopes for global roles', () => {
    for (const role of ['hq', 'super_admin']) {
      expect(validateUserInput({ ...base, role, hallIds: [HALL_A] }, { requireEmail: true }).ok).toBe(false)
      expect(validateUserInput({ ...base, role, hallIds: [] }, { requireEmail: true }).ok).toBe(true)
    }
  })

  it('links merchants to a stand and nobody else', () => {
    expect(validateUserInput({ ...base, role: 'merchant' }, { requireEmail: true }).ok).toBe(false)
    expect(validateUserInput({ ...base, role: 'merchant', merchantId: MERCHANT }, { requireEmail: true }).ok).toBe(true)
    expect(
      validateUserInput({ ...base, role: 'hq', merchantId: MERCHANT }, { requireEmail: true }).ok,
    ).toBe(false)
  })

  it('rejects the legacy admin role and unknown roles', () => {
    expect(validateUserInput({ ...base, role: 'admin' }, { requireEmail: true }).ok).toBe(false)
    expect(validateUserInput({ ...base, role: 'root' }, { requireEmail: true }).ok).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(validateUserInput(null, { requireEmail: true }).ok).toBe(false)
    expect(validateUserInput({ ...base, email: 'nope', role: 'hq' }, { requireEmail: true }).ok).toBe(false)
    expect(validateUserInput({ ...base, firstName: '', role: 'hq' }, { requireEmail: true }).ok).toBe(false)
    expect(validateUserInput({ ...base, role: 'network_manager', hallIds: ['not-a-uuid'] }, { requireEmail: true }).ok).toBe(false)
  })

  it('does not require the e-mail on updates', () => {
    expect(
      validateUserInput({ firstName: 'Jean', lastName: 'Dupont', role: 'hq' }, { requireEmail: false }).ok,
    ).toBe(true)
  })
})

describe('roles', () => {
  it('classifies roles', () => {
    expect(isStaffRole('merchant')).toBe(false)
    expect(isStaffRole('hall_manager')).toBe(true)
    expect(isStaffRole('admin')).toBe(false)
    expect(isGlobalRole('hq')).toBe(true)
    expect(isGlobalRole('network_manager')).toBe(false)
    expect(isHallScopedRole('hall_manager')).toBe(true)
    expect(isHallScopedRole('super_admin')).toBe(false)
  })
})

describe('generatePassword', () => {
  it('generates strong, unique provisional passwords', () => {
    const first = generatePassword()
    expect(first).toHaveLength(14)
    expect(first).toMatch(/[a-z]/)
    expect(first).toMatch(/[A-Z]/)
    expect(first).toMatch(/[0-9]/)
    expect(first).toMatch(/[!@#$%&*?]/)
    expect(generatePassword()).not.toBe(first)
  })
})
