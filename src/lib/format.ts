const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** 'YYYY-MM' -> 'janv. 2026' */
export function formatMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-')
  return MONTH_YEAR_FORMATTER.format(new Date(Number(year), Number(monthNumber) - 1, 1))
}
