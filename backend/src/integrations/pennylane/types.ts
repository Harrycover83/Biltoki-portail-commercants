/**
 * Pennylane API Types
 * Interface for both mock and real API clients
 */

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
