const DAY_MS = 86_400_000

export type RevenueMode = 'day' | 'week'

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

export function weekStart(date: string): string {
  return addDays(date, -weekdayIndex(date))
}

/** ISO 8601 calendar week (Monday to Sunday, week 1 holds the first Thursday of the year). */
export function isoWeek(date: string): { year: number; week: number } {
  const thursday = addDays(weekStart(date), 3)
  const year = Number(thursday.slice(0, 4))
  const week = Math.floor((Date.parse(thursday) - Date.parse(`${year}-01-01`)) / (7 * DAY_MS)) + 1
  return { year, week }
}

export function isoWeeksInYear(year: number): number {
  return isoWeek(`${year}-12-28`).week
}

export function isoWeekMonday(year: number, week: number): string {
  return addDays(weekStart(`${year}-01-04`), (week - 1) * 7)
}

/** Monday of the same calendar week number one year earlier (week 53 falls back to week 52 when absent). */
export function sameWeekLastYear(monday: string): string {
  const { year, week } = isoWeek(monday)
  return isoWeekMonday(year - 1, Math.min(week, isoWeeksInYear(year - 1)))
}

export type Reference = {
  key: 'previousYear' | 'previousWeek'
  /** Monday of the reference week. */
  monday: string
  /** Dates compared with the observed ones, in the same order. */
  dates: string[]
  totalCents: number | null
  comparableDays: number
  comparableCurrentCents: number | null
  comparableReferenceCents: number | null
  trendPercent: number | null
}

export type PeriodComparison = {
  mode: RevenueMode
  monday: string
  week: { year: number; week: number }
  /** Observed dates that already have a closed day, never later than `lastDate`. */
  dates: string[]
  currentCents: number | null
  references: Reference[]
}

export type DateRange = { since: string; until: string }

export function observedDates(mode: RevenueMode, anchor: string, lastDate: string): string[] {
  const monday = weekStart(anchor)
  const offsets = mode === 'day' ? [weekdayIndex(anchor)] : [0, 1, 2, 3, 4, 5, 6]
  return offsets.map((offset) => addDays(monday, offset)).filter((date) => date <= lastDate)
}

/** Date ranges to read so that any day or week selection inside the anchor's week can be compared. */
export function requiredRanges(anchor: string, lastDate: string): DateRange[] {
  const monday = weekStart(anchor)
  const previousYearMonday = sameWeekLastYear(monday)
  const clip = (until: string) => (until > lastDate ? lastDate : until)
  return [
    { since: addDays(monday, -7), until: clip(addDays(monday, 6)) },
    { since: previousYearMonday, until: clip(addDays(previousYearMonday, 6)) },
  ]
}

function sum(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0)
}

/**
 * Compares the observed day or calendar week with the same week last year and with the previous week.
 * Days are paired by weekday; a day without report is never counted as zero, and the trend only uses
 * days present on both sides.
 */
export function comparePeriod(
  mode: RevenueMode,
  anchor: string,
  lookup: (date: string) => number | null,
  lastDate: string,
): PeriodComparison {
  const monday = weekStart(anchor)
  const dates = observedDates(mode, anchor, lastDate)
  const offsets = dates.map((date) => weekdayIndex(date))
  const current = dates.map((date) => lookup(date))

  const build = (key: Reference['key'], referenceMonday: string): Reference => {
    const referenceDates = offsets.map((offset) => addDays(referenceMonday, offset))
    const values = referenceDates.map((date) => lookup(date))
    const pairs = current.flatMap((value, index) =>
      value !== null && values[index] !== null ? [{ current: value, reference: values[index] as number }] : [],
    )
    const comparableCurrentCents = sum(pairs.map((pair) => pair.current))
    const comparableReferenceCents = sum(pairs.map((pair) => pair.reference))
    return {
      key,
      monday: referenceMonday,
      dates: referenceDates,
      totalCents: sum(values.filter((value): value is number => value !== null)),
      comparableDays: pairs.length,
      comparableCurrentCents,
      comparableReferenceCents,
      trendPercent:
        comparableCurrentCents !== null && comparableReferenceCents !== null && comparableReferenceCents > 0
          ? ((comparableCurrentCents - comparableReferenceCents) / comparableReferenceCents) * 100
          : null,
    }
  }

  return {
    mode,
    monday,
    week: isoWeek(monday),
    dates,
    currentCents: sum(current.filter((value): value is number => value !== null)),
    references: [build('previousYear', sameWeekLastYear(monday)), build('previousWeek', addDays(monday, -7))],
  }
}
