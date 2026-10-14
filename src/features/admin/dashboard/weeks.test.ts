import { describe, expect, it } from 'vitest'
import {
  comparePeriod, isoWeek, isoWeekMonday, isoWeeksInYear, lastCompleteWeekDate, observedDates, requiredRanges,
  sameWeekLastYear, weekStart, weekdayIndex,
} from './weeks'

describe('calendar weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekdayIndex('2026-10-18')).toBe(6)
  })

  it('numbers ISO weeks, including year boundaries', () => {
    expect(isoWeek('2026-10-14')).toEqual({ year: 2026, week: 42 })
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 })
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 })
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 })
    expect(isoWeeksInYear(2026)).toBe(53)
    expect(isoWeeksInYear(2025)).toBe(52)
    expect(isoWeekMonday(2026, 42)).toBe('2026-10-12')
  })

  it('finds the same week number last year, falling back when week 53 is absent', () => {
    expect(sameWeekLastYear('2026-10-12')).toBe('2025-10-13')
    expect(sameWeekLastYear('2026-12-28')).toBe('2025-12-22')
    expect(sameWeekLastYear('2027-01-04')).toBe('2025-12-29')
  })

  it('opens a week on the last complete one', () => {
    expect(lastCompleteWeekDate('2026-10-13')).toBe('2026-10-11')
    expect(lastCompleteWeekDate('2026-10-12')).toBe('2026-10-11')
    expect(lastCompleteWeekDate('2026-10-18')).toBe('2026-10-18')
  })

  it('only observes closed days', () => {
    expect(observedDates('week', '2026-10-14', '2026-10-13')).toEqual(['2026-10-12', '2026-10-13'])
    expect(observedDates('day', '2026-10-14', '2026-10-14')).toEqual(['2026-10-14'])
    expect(observedDates('day', '2026-10-14', '2026-10-13')).toEqual([])
  })

  it('lists the ranges to read, clipped to the last closed day', () => {
    expect(requiredRanges('2026-10-14', '2026-10-13')).toEqual([
      { since: '2026-10-05', until: '2026-10-13' },
      { since: '2025-10-13', until: '2025-10-19' },
    ])
  })
})

describe('comparePeriod', () => {
  const data = new Map<string, number>([
    ['2026-10-12', 1200], ['2026-10-13', 9000],
    ['2026-10-05', 1000], ['2026-10-06', 1000],
    ['2025-10-13', 1500], ['2025-10-14', 3000],
  ])
  const lookup = (date: string) => data.get(date) ?? null

  it('compares a calendar week with last year and with the previous week, weekday by weekday', () => {
    const result = comparePeriod('week', '2026-10-13', lookup, '2026-10-13')
    expect(result.week).toEqual({ year: 2026, week: 42 })
    expect(result.currentCents).toBe(10200)
    const [lastYear, lastWeek] = result.references
    expect(lastYear.monday).toBe('2025-10-13')
    expect(lastYear.comparableDays).toBe(2)
    expect(lastYear.trendPercent).toBeCloseTo(((10200 - 4500) / 4500) * 100)
    expect(lastWeek.monday).toBe('2026-10-05')
    expect(lastWeek.trendPercent).toBeCloseTo(((10200 - 2000) / 2000) * 100)
  })

  it('compares a day with the same weekday of the reference weeks', () => {
    const result = comparePeriod('day', '2026-10-13', lookup, '2026-10-13')
    expect(result.currentCents).toBe(9000)
    expect(result.references[0].dates).toEqual(['2025-10-14'])
    expect(result.references[0].trendPercent).toBe(200)
    expect(result.references[1].dates).toEqual(['2026-10-06'])
  })

  it('never turns missing reports into zero and avoids dividing by zero', () => {
    const missing = comparePeriod('day', '2026-10-13', () => null, '2026-10-13')
    expect(missing.currentCents).toBeNull()
    expect(missing.references.every((ref) => ref.trendPercent === null && ref.totalCents === null)).toBe(true)

    const zeroBase = comparePeriod('day', '2026-10-13', (date) => (date === '2026-10-13' ? 500 : date === '2025-10-14' ? 0 : null), '2026-10-13')
    expect(zeroBase.references[0].comparableReferenceCents).toBe(0)
    expect(zeroBase.references[0].trendPercent).toBeNull()
  })
})
