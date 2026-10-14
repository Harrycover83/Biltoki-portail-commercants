import { describe, expect, it } from 'vitest'
import { availableWidgets, defaultLayout, moveWidget, normalizeLayout, toggleWidget } from './widgets'

describe('dashboard widgets', () => {
  it('offers the widgets to staff only', () => {
    expect(availableWidgets('hall_manager').length).toBeGreaterThan(0)
    expect(availableWidgets('merchant')).toEqual([])
    expect(availableWidgets(null)).toEqual([])
  })

  it('shows every widget by default, revenue first', () => {
    const layout = defaultLayout('network_manager')
    expect(layout[0]).toEqual({ id: 'revenue', visible: true })
    expect(layout.every((entry) => entry.visible)).toBe(true)
  })

  it('repairs stored layouts: drops unknown and duplicate widgets, appends new ones', () => {
    const layout = normalizeLayout(
      [{ id: 'stock', visible: false }, { id: 'nope', visible: true }, { id: 'stock', visible: true }, 'junk', null],
      'hall_manager',
    )
    expect(layout[0]).toEqual({ id: 'stock', visible: false })
    expect(layout.map((entry) => entry.id).sort()).toEqual(['finance', 'hr', 'organisation', 'revenue', 'stock'])
  })

  it('falls back to the default layout on garbage', () => {
    expect(normalizeLayout('garbage', 'hq')).toEqual(defaultLayout('hq'))
    expect(normalizeLayout(undefined, 'hq')).toEqual(defaultLayout('hq'))
  })

  it('reorders and toggles without mutating', () => {
    const layout = defaultLayout('hq')
    const moved = moveWidget(layout, 'hr', -1)
    expect(moved[0].id).toBe('hr')
    expect(layout[0].id).toBe('revenue')
    expect(moveWidget(layout, 'revenue', -1)).toBe(layout)
    expect(toggleWidget(layout, 'hr').find((entry) => entry.id === 'hr')?.visible).toBe(false)
  })
})
