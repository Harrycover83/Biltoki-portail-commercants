import { STAFF_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types/domain'

export type DashboardWidgetId = 'revenue' | 'hr' | 'finance' | 'stock' | 'organisation'

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId
  title: string
  description: string
  /** Roles allowed to display this widget; data access itself stays enforced by the database and the API. */
  roles: UserRole[]
  /** `full` spans the whole dashboard width, `half` shares a row. */
  size: 'full' | 'half'
}

export type WidgetPreference = { id: DashboardWidgetId; visible: boolean }

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: 'revenue',
    title: 'Chiffre d’affaires et comparatif N‑1',
    description: 'CA Popina de la période, tendance et détail quotidien.',
    roles: STAFF_ROLES,
    size: 'full',
  },
  { id: 'hr', title: 'RH', description: 'Indicateurs Skello (non connecté).', roles: STAFF_ROLES, size: 'half' },
  { id: 'finance', title: 'Finances', description: 'Synthèse financière (non connectée).', roles: STAFF_ROLES, size: 'half' },
  { id: 'stock', title: 'Stock', description: 'Suivi du stock (non activé).', roles: STAFF_ROLES, size: 'half' },
  { id: 'organisation', title: 'Organisation', description: 'Tâches Notion (non connecté).', roles: STAFF_ROLES, size: 'half' },
]

export function availableWidgets(role: UserRole | null | undefined): DashboardWidgetDefinition[] {
  return role ? DASHBOARD_WIDGETS.filter((widget) => widget.roles.includes(role)) : []
}

export function defaultLayout(role: UserRole | null | undefined): WidgetPreference[] {
  return availableWidgets(role).map((widget) => ({ id: widget.id, visible: true }))
}

/**
 * Turns whatever was stored into a valid layout for this role: unknown or forbidden widgets are dropped,
 * duplicates ignored, and widgets added to the catalog since the last save are appended as visible.
 */
export function normalizeLayout(stored: unknown, role: UserRole | null | undefined): WidgetPreference[] {
  const allowed = new Set<string>(availableWidgets(role).map((widget) => widget.id))
  const seen = new Set<string>()
  const result: WidgetPreference[] = []

  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (typeof entry !== 'object' || entry === null) continue
      const { id, visible } = entry as { id?: unknown; visible?: unknown }
      if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue
      seen.add(id)
      result.push({ id: id as DashboardWidgetId, visible: visible !== false })
    }
  }

  for (const widget of defaultLayout(role)) {
    if (!seen.has(widget.id)) result.push(widget)
  }
  return result
}

export function moveWidget(layout: WidgetPreference[], id: DashboardWidgetId, direction: -1 | 1): WidgetPreference[] {
  const from = layout.findIndex((entry) => entry.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= layout.length) return layout
  const next = [...layout]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

export function toggleWidget(layout: WidgetPreference[], id: DashboardWidgetId): WidgetPreference[] {
  return layout.map((entry) => (entry.id === id ? { ...entry, visible: !entry.visible } : entry))
}
