import { useRef } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { useAdminHall } from '@/features/admin/AdminHallContext'
import { DashboardSettings } from '@/features/admin/dashboard/DashboardSettings'
import { DashboardWidgetFrame } from '@/features/admin/dashboard/DashboardWidgetFrame'
import { RevenueCard } from '@/features/admin/dashboard/RevenueCard'
import { TreasuryCard } from '@/features/admin/dashboard/TreasuryCard'
import { useDashboardLayout } from '@/features/admin/dashboard/useDashboardLayout'
import {
  availableWidgets, hideWidget, moveVisibleWidget, moveWidgetTo, type DashboardWidgetId,
} from '@/features/admin/dashboard/widgets'
import { useAuth } from '@/features/auth/AuthProvider'

const PLACEHOLDERS: Partial<Record<DashboardWidgetId, { subtitle?: string; text: string }>> = {
  hr: { subtitle: 'En attente de Skello', text: 'Aucun indicateur tant que l’accès API n’est pas ouvert.' },
  finance: { text: '' },
  stock: { subtitle: 'Suivi non activé', text: 'Il faut d’abord un inventaire physique initial.' },
  organisation: { subtitle: 'Notion non connecté', text: 'Aucune tâche ni alerte fictive.' },
}

export function AdminDashboardPage() {
  const { selectedHallId, halls, loading } = useAdminHall()
  const { profile } = useAuth()
  const { layout, save, reset } = useDashboardLayout(profile?.id ?? null, profile?.role)
  const dragged = useRef<DashboardWidgetId | null>(null)
  const hall = halls.find((option) => option.id === selectedHallId)
  const definitions = new Map(availableWidgets(profile?.role).map((widget) => [widget.id, widget]))
  const shown = layout.filter((entry) => entry.visible && definitions.has(entry.id))

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="brand-title text-2xl">Dashboard{hall ? ` · ${hall.name}` : ''}</h1>
            <p className="text-sm text-[#615b51]">Pilote Popina : Toulon uniquement. Aucune donnée fictive n’est affichée.</p>
          </div>
          <DashboardSettings role={profile?.role} layout={layout} onChange={save} onReset={reset} />
        </div>
        {shown.length === 0 && <p role="status">Aucun élément affiché. Utilisez la roue crantée pour en ajouter.</p>}
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
          {shown.map(({ id }) => {
            const definition = definitions.get(id)!
            const placeholder = PLACEHOLDERS[id]
            return (
              <div key={id} className={definition.size === 'wide' ? 'md:col-span-2' : undefined}>
                <DashboardWidgetFrame
                  title={definition.title}
                  subtitle={placeholder?.subtitle}
                  icon={definition.icon}
                  compact={definition.size === 'tile'}
                  onRemove={() => save(hideWidget(layout, id))}
                  onMove={(direction) => save(moveVisibleWidget(layout, id, direction))}
                  onDragStart={() => { dragged.current = id }}
                  onDropHere={() => {
                    if (dragged.current) save(moveWidgetTo(layout, dragged.current, id))
                    dragged.current = null
                  }}
                >
                  {id === 'revenue'
                    ? <RevenueCard hall={hall} loading={loading} />
                    : id === 'finance'
                      ? <TreasuryCard hall={hall} loading={loading} />
                      : <p className="text-xs text-[#615b51]">{placeholder?.text}</p>}
                </DashboardWidgetFrame>
              </div>
            )
          })}
        </div>
      </div>
    </PageContainer>
  )
}
