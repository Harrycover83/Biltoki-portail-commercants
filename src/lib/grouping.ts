const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

type MonthBucket<T> = {
  month: string // '01'..'12'
  monthLabel: string // 'janvier'
  items: T[]
}

export type YearBucket<T> = {
  year: string // '2026'
  months: MonthBucket<T>[]
}

/**
 * Groups items by the year and month of their ISO date (YYYY-MM-DD...).
 * Years and months are ordered newest first; items inside a month, oldest first.
 */
export function groupByYearMonth<T>(items: T[], getIsoDate: (item: T) => string): YearBucket<T>[] {
  const monthsByYear = new Map<string, Map<string, T[]>>()

  for (const item of [...items].sort((a, b) => getIsoDate(a).localeCompare(getIsoDate(b)))) {
    const isoDate = getIsoDate(item)
    const year = isoDate.slice(0, 4)
    const month = isoDate.slice(5, 7)

    const monthMap = monthsByYear.get(year) ?? new Map<string, T[]>()
    monthMap.set(month, [...(monthMap.get(month) ?? []), item])
    monthsByYear.set(year, monthMap)
  }

  return [...monthsByYear.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, monthMap]) => ({
      year,
      months: [...monthMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, monthItems]) => ({
          month,
          monthLabel: MONTH_NAME_FORMATTER.format(new Date(Date.UTC(Number(year), Number(month) - 1, 1))),
          items: monthItems,
        })),
    }))
}
