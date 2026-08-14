import { useEffect, useState, type FormEvent } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { getSupabaseClient } from '../../../lib/supabase'

type HallOption = {
  id: string
  name: string
}

type PeriodRow = {
  id: string
  hall_id: string
  label: string
  period_start: string
  period_end: string
  status: 'draft' | 'calculated' | 'validated' | 'closed'
  halls: {
    name: string
  } | null
}

type PeriodRowRaw = Omit<PeriodRow, 'halls'> & {
  halls: PeriodRow['halls'] | PeriodRow['halls'][]
}

function singleOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value
}

export function AdminPeriodsPage() {
  const [halls, setHalls] = useState<HallOption[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [hallId, setHallId] = useState('')
  const [label, setLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const loadData = async () => {
    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      setLoading(false)
      return
    }

    const [hallsResult, periodsResult] = await Promise.all([
      client.from('halls').select('id, name').order('name', { ascending: true }),
      client
        .from('service_charge_periods')
        .select('id, hall_id, label, period_start, period_end, status, halls(name)')
        .order('period_end', { ascending: false }),
    ])

    if (hallsResult.error) {
      setError(hallsResult.error.message)
      setLoading(false)
      return
    }
    if (periodsResult.error) {
      setError(periodsResult.error.message)
      setLoading(false)
      return
    }

    const loadedHalls = (hallsResult.data ?? []) as HallOption[]
    setHalls(loadedHalls)
    if (!hallId && loadedHalls[0]) {
      setHallId(loadedHalls[0].id)
    }

    const rawPeriods = (periodsResult.data ?? []) as unknown as PeriodRowRaw[]
    const normalized = rawPeriods.map((period) => ({
      ...period,
      halls: singleOrNull(period.halls),
    }))

    setPeriods(normalized)
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const onCreatePeriod = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      return
    }

    setSaving(true)
    const { error: insertError } = await client.from('service_charge_periods').insert({
      hall_id: hallId,
      label,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setLabel('')
    setPeriodStart('')
    setPeriodEnd('')
    await loadData()
    setSaving(false)
  }

  const onUpdateStatus = async (periodId: string, status: PeriodRow['status']) => {
    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      return
    }

    const { error: updateError } = await client
      .from('service_charge_periods')
      .update({ status })
      .eq('id', periodId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadData()
  }

  const onClosePeriod = async (periodId: string) => {
    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      return
    }

    const { error: closeError } = await client.rpc('close_period', { p_period_id: periodId })
    if (closeError) {
      setError(closeError.message)
      return
    }

    await loadData()
  }

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement des periodes..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}

      {!loading ? (
        <div className="space-y-5">
          <Card title="Nouvelle periode" subtitle="Creer un mois de frais reel pour une halle.">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreatePeriod}>
              <label className="block text-sm text-[#4d5562]">
                Halle
                <select
                  className="brand-input mt-1"
                  required
                  value={hallId}
                  onChange={(event) => setHallId(event.target.value)}
                >
                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-[#4d5562]">
                Label (ex: Aout 2026)
                <input
                  className="brand-input mt-1"
                  required
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </label>

              <label className="block text-sm text-[#4d5562]">
                Debut
                <input
                  type="date"
                  className="brand-input mt-1"
                  required
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>

              <label className="block text-sm text-[#4d5562]">
                Fin
                <input
                  type="date"
                  className="brand-input mt-1"
                  required
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>

              <div className="md:col-span-2">
                <button className="brand-button" disabled={saving} type="submit">
                  {saving ? 'Creation...' : 'Creer la periode'}
                </button>
              </div>
            </form>
          </Card>

          <Card title="Periodes" subtitle="Draft, calculated, validated, closed.">
            {periods.length === 0 ? (
              <StateMessage variant="empty" title="Aucune periode" message="Creez votre premiere periode ci-dessus." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#13223a1f] text-[#626a78]">
                      <th className="py-2">Periode</th>
                      <th className="py-2">Halle</th>
                      <th className="py-2">Dates</th>
                      <th className="py-2">Statut</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr key={period.id} className="border-b border-slate-100/80 last:border-b-0">
                        <td className="py-3 font-medium text-[#13223a]">{period.label}</td>
                        <td className="py-3">{period.halls?.name ?? '-'}</td>
                        <td className="py-3">
                          {period.period_start} - {period.period_end}
                        </td>
                        <td className="py-3">
                          <StatusBadge status={period.status} />
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <select
                              className="brand-input w-[160px]"
                              value={period.status}
                              onChange={(event) =>
                                void onUpdateStatus(period.id, event.target.value as PeriodRow['status'])
                              }
                            >
                              <option value="draft">draft</option>
                              <option value="calculated">calculated</option>
                              <option value="validated">validated</option>
                              <option value="closed">closed</option>
                            </select>
                            {period.status !== 'closed' ? (
                              <button
                                className="rounded-full border border-[#13223a33] px-3 py-2 text-xs font-semibold text-[#13223a] hover:bg-[#13223a0f]"
                                onClick={() => {
                                  void onClosePeriod(period.id)
                                }}
                                type="button"
                              >
                                Cloturer
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
