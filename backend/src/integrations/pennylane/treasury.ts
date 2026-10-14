import type { PennylaneBankAccount, PennylaneSupplierInvoice } from './types.js'

export type ProAccountBalance = {
  name: string
  currency: string
  balanceCents: number
  /** When Pennylane last refreshed this balance. */
  updatedAt: string
}

export type InvoicesToApprove = {
  count: number
  /** Total including tax, in cents. */
  totalCents: number
  /** True when the invoice list was cut off, so the figures are a lower bound. */
  truncated: boolean
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

/**
 * Invoices of the Pennylane "Achats > Plus > À approuver" filter: received through the PA and waiting for the
 * company's approval (`e_invoicing.status = waiting_for_validation`). Archived invoices are no longer actionable.
 * "En litige" (`disputed`) is a separate status and is deliberately not counted.
 */
export function countInvoicesToApprove(invoices: PennylaneSupplierInvoice[], truncated: boolean): InvoicesToApprove {
  let count = 0
  let totalCents = 0
  for (const invoice of invoices) {
    if (invoice.e_invoicing?.status !== 'waiting_for_validation' || invoice.accounting_status === 'archived') continue
    count += 1
    totalCents += decimalToCents(invoice.amount) ?? 0
  }
  return { count, totalCents, truncated }
}
