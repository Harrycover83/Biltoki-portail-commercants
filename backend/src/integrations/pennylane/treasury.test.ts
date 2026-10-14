import { describe, expect, it } from 'vitest'
import { decimalToCents, selectProAccount } from './treasury.js'
import type { PennylaneBankAccount } from './types.js'

function account(id: number, name: string, balance = '10.00'): PennylaneBankAccount {
  return { id, name, currency: 'EUR', balance, created_at: '2024-01-01T00:00:00Z', updated_at: '2026-10-14T03:41:09Z' }
}

describe('decimalToCents', () => {
  it('converts decimal strings without floating point drift', () => {
    expect(decimalToCents('906.37')).toBe(90_637)
    expect(decimalToCents('0.1')).toBe(10)
    expect(decimalToCents('-12.5')).toBe(-1250)
    expect(decimalToCents('82590')).toBe(8_259_000)
    expect(decimalToCents('19.999')).toBe(1999)
  })

  it('rejects anything that is not a plain decimal', () => {
    for (const value of ['', 'abc', '1e3', '1,5', null, undefined]) expect(decimalToCents(value)).toBeNull()
  })
})

describe('selectProAccount', () => {
  const accounts = [account(1, 'S.A.S. BILTOKI TOULON', '82590.94'), account(2, 'Compte Pro Pennylane', '906.37')]

  it('finds the Compte Pro by name', () => {
    expect(selectProAccount(accounts)).toMatchObject({ name: 'Compte Pro Pennylane', balanceCents: 90_637, currency: 'EUR' })
  })

  it('prefers an explicit account id', () => {
    expect(selectProAccount(accounts, 1)).toMatchObject({ balanceCents: 8_259_094 })
    expect(selectProAccount(accounts, 99)).toBeNull()
  })

  it('refuses to guess when no or several accounts match', () => {
    expect(selectProAccount([account(1, 'Courant')])).toBeNull()
    expect(selectProAccount([account(1, 'Compte pro A'), account(2, 'compte pro B')])).toBeNull()
  })

  it('refuses an unreadable balance', () => {
    expect(selectProAccount([account(2, 'Compte Pro', 'n/a')])).toBeNull()
  })
})
