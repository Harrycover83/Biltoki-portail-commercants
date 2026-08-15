import { useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getSupabaseClient } from '../../../lib/supabase'
import { formatEuroFromCents } from '../../../lib/money'

type AdminPeriodOption = {
  id: string
  hall_id: string
  label: string
  period_end: string
}

type AdminHallOption = {
  id: string
  name: string
}

type AdminChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
}

export function AdminServiceChargesPage() {
  const [halls, setHalls] = useState<AdminHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [periods, setPeriods] = useState<AdminPeriodOption[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPeriods = async () => {
      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        setLoading(false)
        return
      }

      const [periodsResponse, hallsResponse] = await Promise.all([
        client
          .from('service_charge_periods')
          .select('id, hall_id, label, period_end')
          .order('period_end', { ascending: false }),
        client.from('halls').select('id, name').order('name', { ascending: true }),
      ])

      if (periodsResponse.error) {
        setError(periodsResponse.error.message)
        setLoading(false)
        return
      }

      if (hallsResponse.error) {
        setError(hallsResponse.error.message)
        setLoading(false)
        return
      }

      const hallOptions = (hallsResponse.data ?? []) as AdminHallOption[]
      setHalls(hallOptions)
      const initialHallId = hallOptions[0]?.id ?? ''
      setSelectedHallId(initialHallId)

      const allPeriods = (periodsResponse.data ?? []) as AdminPeriodOption[]
      const filteredPeriods = initialHallId
        ? allPeriods.filter((period) => period.hall_id === initialHallId)
        : allPeriods

      setPeriods(filteredPeriods)
      setSelectedPeriodId(filteredPeriods[0]?.id ?? '')
      setLoading(false)
    }

    void loadPeriods()
  }, [])

  useEffect(() => {
    const reloadPeriodsForHall = async () => {
      if (!selectedHallId) {
        setPeriods([])
        setSelectedPeriodId('')
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        return
      }

      const { data, error: periodsError } = await client
        .from('service_charge_periods')
        .select('id, hall_id, label, period_end')
        .eq('hall_id', selectedHallId)
        .order('period_end', { ascending: false })

      if (periodsError) {
        setError(periodsError.message)
        return
      }

      const options = (data ?? []) as AdminPeriodOption[]
      setPeriods(options)
      setSelectedPeriodId(options[0]?.id ?? '')
    }

    if (!loading) {
      void reloadPeriodsForHall()
    }
  }, [loading, selectedHallId])

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedPeriodId) {
        setRows([])
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        return
      }

      setLoadingRows(true)
      const { data, error: rowsError } = await client
        .from('service_charges')
        .select('id, label, category, amount_incl_tax')
        .eq('period_id', selectedPeriodId)
        .order('label', { ascending: true })

      if (rowsError) {
        setError(rowsError.message)
        setLoadingRows(false)
        return
      }

      setRows((data ?? []) as AdminChargeRow[])
      setError(null)
      setLoadingRows(false)
    }

    if (!loading) {
      void loadRows()
    }
  }, [loading, selectedPeriodId])

  const selectedPeriodLabel =
    periods.find((period) => period.id === selectedPeriodId)?.label ?? 'Periode'

  const totalCents = useMemo(
    () => rows.reduce((sum, row) => sum + Math.round(Number(row.amount_incl_tax) * 100), 0),
    [rows],
  )

  const onSyncPennylane = async () => {
    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      return
    }

    setSyncing(true)
    const { error: syncError } = await client.functions.invoke('pennylane-sync')

    if (syncError) {
      setError(syncError.message)
      setSyncing(false)
      return
    }

    setError(null)
    setSyncing(false)
  }

  return (
    <PageContainer>
      {loading || loadingRows ? <StateMessage variant="loading" title="Chargement des frais admin..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}

      {!loading && !error ? (
        <Card title="Frais de service" subtitle={`Periode ${selectedPeriodLabel}`}>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#13223a17] bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#4d5562]">
              Source unique: Pennylane. Cette vue est en lecture et alimentee par la synchronisation.
            </p>
            <button
              className="brand-button w-fit"
              disabled={syncing}
              type="button"
              onClick={() => {
                void onSyncPennylane()
              }}
            >
              {syncing ? 'Synchronisation...' : 'Synchroniser Pennylane'}
            </button>
          </div>

          {halls.length > 0 ? (
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-hall-select">
                  Halle
                </label>
                <select
                  id="admin-hall-select"
                  value={selectedHallId}
                  onChange={(event) => setSelectedHallId(event.target.value)}
                  className="brand-input"
                >
                  {halls.map((hall) => (
                    <option key={hall.id} value={hall.id}>
                      {hall.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
              <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-period-select">
                Mois a consulter
              </label>
              <select
                id="admin-period-select"
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
                className="brand-input max-w-sm"
                disabled={periods.length === 0}
              >
                {periods.length === 0 ? <option value="">Aucune periode</option> : null}
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
              </div>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <StateMessage
              variant="empty"
              title="Aucun frais pour cette periode"
              message="Aucun frais synchronise depuis Pennylane pour cette periode."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#13223a1f] text-[#626a78]">
                      <th className="py-2">Poste</th>
                      <th className="py-2">Categorie</th>
                      <th className="py-2 text-right">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100/80 last:border-b-0">
                        <td className="py-3">{row.label}</td>
                        <td className="py-3">{row.category ?? '-'}</td>
                        <td className="py-3 text-right font-semibold text-[#13223a]">
                          {formatEuroFromCents(Math.round(Number(row.amount_incl_tax) * 100))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-right text-sm font-semibold text-[#13223a]">
                Total periode: {formatEuroFromCents(totalCents)}
              </p>
            </>
          )}
        </Card>
      ) : null}
    </PageContainer>
  )
}
