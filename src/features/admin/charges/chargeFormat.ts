import { formatEuroFromCents } from '@/lib/money'

const PERCENT_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** '+1 234,00 €' / '−50,00 €' / '0,00 €' */
export function formatSignedEuro(cents: number): string {
  if (cents === 0) {
    return formatEuroFromCents(0)
  }
  return `${cents > 0 ? '+' : '−'}${formatEuroFromCents(Math.abs(cents))}`
}

/** '+7,5 %' / '−12 %', or an em dash when the reference was zero. */
export function formatSignedPercent(pct: number | null): string {
  if (pct === null) {
    return '—'
  }
  const rounded = Math.round(pct * 10) / 10
  if (rounded === 0) {
    return '0 %'
  }
  return `${rounded > 0 ? '+' : '−'}${PERCENT_FORMATTER.format(Math.abs(rounded))} %`
}

/** A bigger bill is bad news (red), a smaller one is good news (green). */
export function deltaTextClass(cents: number): string {
  if (cents > 0) {
    return 'text-[#b3361b]'
  }
  return cents < 0 ? 'text-[#2b7a4b]' : 'text-[#626a78]'
}
