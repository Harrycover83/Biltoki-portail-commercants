import { useEffect, useState } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { getSupabaseClient } from '../../../lib/supabase'
import { formatEuroFromCents } from '../../../lib/money'
import { useAdminHall } from '../AdminHallContext'

type PeriodStatus = 'draft' | 'calculated' | 'validated' | 'closed'

type DashboardData = {
  hallName: string
  periodLabel: string
  periodStatus: PeriodStatus
  merchantCount: number
  standCount: number
  totalLinearMeters: number
  totalChargesCents: number
  chargeCount: number
}

export function AdminDashboardPage() {
  const { selectedHallId, loading: loadingHalls } = useAdminHall()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!selectedHallId) {
        setData(null)
        setLoading(false)
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        setLoading(false)
        return
      }

      const today = new Date().toISOString().slice(0, 10)

      const { data: period, error: periodError } = await client
        .from('service_charge_periods')
        .select('id, label, status, hall_id, halls(name)')
        .eq('hall_id', selectedHallId)
        .lte('period_start', today)
        .gte('period_end', today)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (periodError) {
        setError(periodError.message)
        setLoading(false)
        return
      }

      if (!period) {
        setData(null)
        setError(null)
        setLoading(false)
        return
      }

      const hallId = period.hall_id as string
      const hallRelation = period.halls as { name: string } | { name: string }[] | null
      const hallName = (Array.isArray(hallRelation) ? hallRelation[0]?.name : hallRelation?.name) ?? 'Halle inconnue'

      const [merchantsResult, standsResult, chargesResult] = await Promise.all([
        client.from('merchants').select('id', { count: 'exact', head: true }).eq('hall_id', hallId).eq('active', true),
        client.from('stands').select('linear_meters').eq('hall_id', hallId).eq('active', true),
        client.from('service_charges').select('amount_incl_tax').eq('period_id', period.id),
      ])

      const totalLinearMeters = (standsResult.data ?? []).reduce(
        (sum, stand) => sum + Number(stand.linear_meters ?? 0),
        0,
      )
      const totalChargesCents = (chargesResult.data ?? []).reduce(
        (sum, charge) => sum + Math.round(Number(charge.amount_incl_tax) * 100),
        0,
      )

      setData({
        hallName,
        periodLabel: period.label,
        periodStatus: period.status as PeriodStatus,
        merchantCount: merchantsResult.count ?? 0,
        standCount: (standsResult.data ?? []).length,
        totalLinearMeters,
        totalChargesCents,
        chargeCount: (chargesResult.data ?? []).length,
      })
      setError(null)
      setLoading(false)
    }

    void load()
  }, [selectedHallId])

  return (
    <PageContainer>
      {loadingHalls || loading ? <StateMessage variant="loading" title="Chargement..." /> : null}
      {!loadingHalls && !loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loadingHalls && !loading && !error && !data ? (
        <StateMessage
          variant="empty"
          title="Aucune periode en cours"
          message="Lancez une synchronisation Pennylane pour creer la periode du mois courant."
        />
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Card title={data.hallName} subtitle={`Periode en cours: ${data.periodLabel}`}>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Commercants actifs', value: String(data.merchantCount) },
                { label: 'Stands actifs', value: String(data.standCount) },
                { label: 'Total metres lineaires', value: `${data.totalLinearMeters} ml` },
                { label: 'Factures du mois', value: String(data.chargeCount) },
                { label: 'Total frais du mois', value: formatEuroFromCents(data.totalChargesCents) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">Statut periode:</span>
              <StatusBadge status={data.periodStatus} />
            </div>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
