const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** ISO timestamp -> '05/10/2026 10:30', or an em dash when there is no value. */
export function formatDateTime(value: string | null): string {
  return value ? DATE_TIME_FORMATTER.format(new Date(value)) : '—'
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** 'YYYY-MM' -> 'janv. 2026' */
export function formatMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-')
  return MONTH_YEAR_FORMATTER.format(new Date(Number(year), Number(monthNumber) - 1, 1))
}
