import type { PennylaneBankAccount } from './types.js'

export type ProAccountBalance = {
  name: string
  currency: string
  balanceCents: number
  /** When Pennylane last refreshed this balance. */
  updatedAt: string
}

/** Converts a Pennylane decimal string ("1234.56") to integer cents; null when it is not a plain decimal. */
export function decimalToCents(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const match = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(value.trim())
  if (!match) return null
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return match[1] ? -cents : cents
}

/**
 * Picks the Pennylane "Compte Pro" account. An explicit id wins; otherwise the account must be the only one
 * whose name contains "compte pro", because guessing between several accounts would show a wrong balance.
 */
export function selectProAccount(accounts: PennylaneBankAccount[], configuredId?: number): ProAccountBalance | null {
  const candidates = configuredId
    ? accounts.filter((account) => account.id === configuredId)
    : accounts.filter((account) => /compte\s*pro/i.test(account.name))
  if (candidates.length !== 1) return null
  const [account] = candidates
  const balanceCents = decimalToCents(account.balance)
  if (balanceCents === null) return null
  return { name: account.name, currency: account.currency, balanceCents, updatedAt: account.updated_at }
}
