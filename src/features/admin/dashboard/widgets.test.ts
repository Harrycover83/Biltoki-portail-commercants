import { describe, expect, it } from 'vitest'
import {
  availableWidgets, defaultLayout, hideWidget, moveVisibleWidget, moveWidget, moveWidgetTo, normalizeLayout, toggleWidget,
} from './widgets'

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

  it('hides a widget and moves among the displayed ones only', () => {
    const layout = hideWidget(defaultLayout('hq'), 'hr')
    expect(layout.find((entry) => entry.id === 'hr')?.visible).toBe(false)
    // 'finance' skips the hidden 'hr' and swaps with 'revenue'
    expect(moveVisibleWidget(layout, 'finance', -1).map((entry) => entry.id).slice(0, 3)).toEqual(['finance', 'hr', 'revenue'])
    expect(moveVisibleWidget(layout, 'revenue', -1)).toBe(layout)
    expect(moveVisibleWidget(layout, 'organisation', 1)).toBe(layout)
  })

  it('moves a dragged widget onto the place of another', () => {
    const layout = defaultLayout('hq')
    expect(moveWidgetTo(layout, 'organisation', 'revenue').map((entry) => entry.id)).toEqual([
      'organisation', 'revenue', 'hr', 'finance', 'stock',
    ])
    expect(moveWidgetTo(layout, 'revenue', 'revenue')).toBe(layout)
  })
})
