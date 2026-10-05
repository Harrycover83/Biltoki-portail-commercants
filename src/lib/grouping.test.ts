import { describe, expect, it } from 'vitest'
import { groupByYearMonth } from './grouping'

describe('groupByYearMonth', () => {
  const items = [
    { id: 'a', date: '2026-01-15' },
    { id: 'b', date: '2025-12-31' },
    { id: 'c', date: '2026-01-02' },
    { id: 'd', date: '2026-03-10' },
  ]

  it('orders years and months newest first', () => {
    const groups = groupByYearMonth(items, (item) => item.date)

    expect(groups.map((group) => group.year)).toEqual(['2026', '2025'])
    expect(groups[0].months.map((month) => month.month)).toEqual(['03', '01'])
  })

  it('orders items oldest first inside a month', () => {
    const [group] = groupByYearMonth(items, (item) => item.date)

    expect(group.months[1].items.map((item) => item.id)).toEqual(['c', 'a'])
  })

  it('labels months in French', () => {
    const [group] = groupByYearMonth(items, (item) => item.date)

    expect(group.months.map((month) => month.monthLabel)).toEqual(['mars', 'janvier'])
  })

  it('returns an empty list when there is nothing to group', () => {
    expect(groupByYearMonth([], () => '')).toEqual([])
  })
})
