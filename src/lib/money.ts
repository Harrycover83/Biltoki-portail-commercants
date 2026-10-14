export function formatEuroFromCents(cents: number): string {
  const euros = cents / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(euros)
}

export function formatEuroRounded(euros: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(euros)
}

/** Largest amount a declaration may hold, in cents (matches the database constraint). */
export const MAX_DECLARED_CENTS = 100_000_000_000

/**
 * Reads an amount typed by a person ("1234", "1 234,5", "1234.56 €") as integer cents.
 * Returns null for anything that is not a non-negative amount with at most two decimals.
 */
export function parseEuroInput(text: string): number | null {
  const cleaned = text.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_DECLARED_CENTS ? cents : null
}

/** Cents as an editable euro amount with a decimal comma ("12000,50"), without currency or grouping. */
export function centsToEuroInput(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`
}

