/**
 * Pennylane Company API v2 types.
 * Reference: https://pennylane.readme.io/reference/getsupplierinvoices
 *
 * Monetary fields are returned as decimal strings in euros, never as numbers.
 */

export type PennylaneList<T> = {
  items: T[]
  has_more: boolean
  next_cursor: string | null
}

export type PennylaneMe = {
  id: string
  email?: string
  role?: string
  company?: {
    id?: number
    name?: string
    reg_no?: string
  }
}

export type PennylaneCategoryGroup = {
  id: number
  name: string
  description?: string | null
}

export type PennylaneCategory = {
  id: number
  label: string
  description?: string | null
  category_group?: {
    id: number
    name?: string
  } | null
}

export type PennylaneWeightedCategory = {
  id: number
  label?: string
  weight: string
}

export type PennylaneSupplierInvoice = {
  id: number
  label: string | null
  invoice_number: string
  currency: string
  /** Total including tax, in euros. */
  amount: string
  /** Tax amount, in euros. */
  tax: string
  currency_amount: string
  currency_amount_before_tax: string
  date: string | null
  deadline: string | null
  accounting_status: 'draft' | 'archived' | 'entry' | 'validation_needed' | 'complete'
  paid: boolean
  payment_status: string
  supplier: { id: number; url: string } | null
  categories: { url: string }
  invoice_lines: { url: string }
  external_reference?: string
  created_at: string
  updated_at: string
}

export type PennylaneInvoiceLine = {
  id: number
  label?: string | null
  quantity?: string
  amount?: string
  currency_amount?: string
  ledger_account?: { id: number; number?: string; label?: string } | null
}

export type PennylaneSupplier = {
  id: number
  name?: string
  reg_no?: string | null
}

export type PennylaneFilter = {
  field: string
  operator: 'lt' | 'lteq' | 'gt' | 'gteq' | 'eq' | 'not_eq' | 'in' | 'not_in'
  value: string | string[]
}

/** Normalized shape consumed by the sync service. */
export type PennylaneServiceCharge = {
  id: string
  label: string
  categoryLabel?: string
  amountExclTax: number // in euros
  taxAmount: number // in euros
  amountInclTax: number // in euros
  taxRate?: number // percentage, e.g., 20 for 20%
  description?: string
  createdAt?: string
  updatedAt?: string
}

export type PennylaneServiceChargesResponse = {
  charges: PennylaneServiceCharge[]
  totalCount: number
  hasMore: boolean
}

export type PennylaneError = {
  code: string
  message: string
  details?: Record<string, unknown>
}
