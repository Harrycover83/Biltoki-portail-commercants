import { useState } from 'react'
import {
  availableWidgets,
  moveWidget,
  toggleWidget,
  type DashboardWidgetId,
  type WidgetPreference,
} from '@/features/admin/dashboard/widgets'
import type { UserRole } from '@/types/domain'

type Props = {
  role: UserRole | null | undefined
  layout: WidgetPreference[]
  onChange: (layout: WidgetPreference[]) => void
  onReset: () => void
}

export function DashboardSettings({ role, layout, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const definitions = new Map(availableWidgets(role).map((widget) => [widget.id, widget]))

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Personnaliser le dashboard"
        aria-expanded={open}
        aria-controls="dashboard-settings"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#171511] text-xl hover:bg-[#f7e7b8]"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open ? (
        <section
          id="dashboard-settings"
          aria-label="Paramètres du dashboard"
          className="absolute right-0 z-10 mt-2 w-80 border border-[#d6cebf] bg-[#fffcf6] p-4 shadow-lg"
        >
          <h2 className="brand-title text-base">Éléments affichés</h2>
          <ul className="mt-3 space-y-2">
            {layout.map((entry, index) => {
              const widget = definitions.get(entry.id)
              if (!widget) return null
              const label = (id: DashboardWidgetId, action: string) => `${action} ${definitions.get(id)?.title ?? id}`
              return (
                <li key={entry.id} className="flex items-start gap-2 text-sm">
                  <input
                    id={`widget-${entry.id}`}
                    type="checkbox"
                    checked={entry.visible}
                    onChange={() => onChange(toggleWidget(layout, entry.id))}
                    className="mt-1"
                  />
                  <label htmlFor={`widget-${entry.id}`} className="flex-1">
                    <span className="font-semibold">{widget.title}</span>
                    <span className="block text-xs text-[#615b51]">{widget.description}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={label(entry.id, 'Monter')}
                    disabled={index === 0}
                    onClick={() => onChange(moveWidget(layout, entry.id, -1))}
                    className="px-1 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={label(entry.id, 'Descendre')}
                    disabled={index === layout.length - 1}
                    onClick={() => onChange(moveWidget(layout, entry.id, 1))}
                    className="px-1 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={onReset} className="mt-4 text-sm font-bold underline">
            Réinitialiser
          </button>
        </section>
      ) : null}
    </div>
  )
}
