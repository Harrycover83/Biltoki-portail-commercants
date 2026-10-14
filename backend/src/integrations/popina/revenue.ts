import type { PopinaReport } from './client.js'

const DAY_MS = 86_400_000
const PARIS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function parisDate(date: Date): string {
  return PARIS_DATE.format(date)
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10)
}

export function previousYear(date: string): string | null {
  const previous = `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`
  return isDate(previous) ? previous : null
}

export function validPeriod(since: unknown, until: unknown, today = parisDate(new Date())): boolean {
  return isDate(since) && isDate(until) && since >= '2001-01-01' && since <= until &&
    until < today && (Date.parse(until) - Date.parse(since)) / DAY_MS < 93
}

function dailyTotals(reports: PopinaReport[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const report of reports) {
    // Assign overnight shifts to their opening day, in the hall's timezone.
    const day = parisDate(new Date(report.startedAt))
    const total = (totals.get(day) ?? 0) + report.totalSales
    if (!Number.isSafeInteger(total)) throw new Error('Popina revenue exceeds the safe integer range')
    totals.set(day, total)
  }
  return totals
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((a, b) => a + b, 0)
  if (!Number.isSafeInteger(total)) throw new Error('Popina revenue exceeds the safe integer range')
  return total
}

export function dailyRevenue(since: string, until: string, reports: PopinaReport[]) {
  const totals = dailyTotals(reports)
  const days: { date: string; cents: number | null }[] = []
  for (let date = since; date <= until; date = addDays(date, 1)) {
    days.push({ date, cents: totals.get(date) ?? null })
  }
  return { since, until, days }
}

export function compareRevenue(since: string, until: string, current: PopinaReport[], previous: PopinaReport[]) {
  const currentTotals = dailyTotals(current)
  const previousTotals = dailyTotals(previous)
  const daily: { date: string; previousDate: string | null; currentCents: number | null; previousCents: number | null }[] = []
  for (let date = since; date <= until; date = addDays(date, 1)) {
    const previousDate = previousYear(date)
    daily.push({
      date, previousDate,
      currentCents: currentTotals.get(date) ?? null,
      previousCents: previousDate ? previousTotals.get(previousDate) ?? null : null,
    })
  }
  const paired = daily.filter((day) => day.currentCents !== null && day.previousCents !== null)
  const comparableCurrentCents = sum(paired.map((day) => day.currentCents!))
  const comparablePreviousCents = sum(paired.map((day) => day.previousCents!))
  return {
    since, until,
    totalCurrentCents: sum(daily.flatMap((day) => day.currentCents === null ? [] : [day.currentCents])),
    totalPreviousCents: sum(daily.flatMap((day) => day.previousCents === null ? [] : [day.previousCents])),
    comparableDays: paired.length,
    comparableCurrentCents,
    comparablePreviousCents,
    trendPercent: comparableCurrentCents !== null && comparablePreviousCents !== null && comparablePreviousCents > 0
      ? (comparableCurrentCents - comparablePreviousCents) / comparablePreviousCents * 100 : null,
    daily,
  }
}
