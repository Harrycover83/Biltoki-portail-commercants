import { describe, expect, it } from 'vitest'
import type { PopinaReport } from './client.js'
import { compareRevenue, dailyRevenue, previousYear, validPeriod } from './revenue.js'

function report(id: string, startedAt: string, totalSales: number): PopinaReport {
  return { id, locationId: 'toulon', startedAt, finalizedAt: startedAt, totalSales }
}

describe('Popina daily revenue', () => {
  it('returns one entry per day, null (not zero) when no report exists, and ignores padding days', () => {
    const result = dailyRevenue('2026-10-05', '2026-10-07', [
      report('pad', '2026-10-04T10:00:00Z', 7000),
      report('a', '2026-10-05T08:00:00Z', 1000),
      report('b', '2026-10-05T12:00:00Z', 500),
      report('c', '2026-10-07T10:00:00Z', 0),
      report('pad2', '2026-10-08T10:00:00Z', 7000),
    ])
    expect(result.days).toEqual([
      { date: '2026-10-05', cents: 1500 },
      { date: '2026-10-06', cents: null },
      { date: '2026-10-07', cents: 0 },
    ])
  })
})

describe('Popina N-1 revenue', () => {
  it('sums multiple tills and attributes UTC dates to the opening day in Paris', () => {
    const result = compareRevenue('2026-10-02', '2026-10-02', [
      report('a', '2026-10-01T22:30:00Z', 1000),
      report('b', '2026-10-02T10:00:00Z', 2000),
      report('c', '2026-10-03T10:00:00Z', 9000),
    ], [report('p', '2025-10-02T10:00:00Z', 2500)])
    expect(result.totalCurrentCents).toBe(3000)
    expect(result.totalPreviousCents).toBe(2500)
    expect(result.trendPercent).toBe(20)
  })

  it('calculates the trend on matched dates only and never treats missing reports as zero', () => {
    const result = compareRevenue('2026-10-01', '2026-10-03', [
      report('a', '2026-10-01T10:00:00Z', 1200),
      report('b', '2026-10-02T10:00:00Z', 9000),
    ], [report('p', '2025-10-01T10:00:00Z', 1000)])
    expect(result.totalCurrentCents).toBe(10200)
    expect(result.comparableDays).toBe(1)
    expect(result.comparableCurrentCents).toBe(1200)
    expect(result.trendPercent).toBe(20)
    expect(result.daily[2].currentCents).toBeNull()
    expect(compareRevenue('2026-10-01', '2026-10-01', [], []).totalCurrentCents).toBeNull()
  })

  it('preserves actual zero reports, refunds, and avoids division by zero', () => {
    const result = compareRevenue('2026-10-01', '2026-10-01', [
      report('a', '2026-10-01T10:00:00Z', -500),
    ], [report('p', '2025-10-01T10:00:00Z', 0)])
    expect(result.totalCurrentCents).toBe(-500)
    expect(result.totalPreviousCents).toBe(0)
    expect(result.comparableDays).toBe(1)
    expect(result.trendPercent).toBeNull()
  })

  it('does not count 28 February twice when comparing leap years', () => {
    expect(previousYear('2024-02-29')).toBeNull()
    const result = compareRevenue('2024-02-28', '2024-02-29', [
      report('a', '2024-02-28T10:00:00Z', 1000), report('b', '2024-02-29T10:00:00Z', 2000),
    ], [report('p', '2023-02-28T10:00:00Z', 1000)])
    expect(result.totalPreviousCents).toBe(1000)
    expect(result.comparableDays).toBe(1)
    expect(result.daily[1].previousDate).toBeNull()
  })

  it('validates real dates, past periods and the exact 93-day limit', () => {
    expect(validPeriod('2026-01-01', '2026-04-03', '2026-10-12')).toBe(true)
    expect(validPeriod('2026-01-01', '2026-04-04', '2026-10-12')).toBe(false)
    expect(validPeriod('2026-02-30', '2026-03-02', '2026-10-12')).toBe(false)
    expect(validPeriod('2026-10-12', '2026-10-12', '2026-10-12')).toBe(false)
    expect(validPeriod('2026-10-11', '2026-10-10', '2026-10-12')).toBe(false)
    expect(validPeriod(['2026-10-01'], '2026-10-11', '2026-10-12')).toBe(false)
  })
})
