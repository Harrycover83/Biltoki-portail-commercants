import { useEffect, useMemo, useState, type FormEvent } from 'react'
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

type AdminChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
}

export function AdminServiceChargesPage() {
  const [periods, setPeriods] = useState<AdminPeriodOption[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState('operation')
  const [amountExclTax, setAmountExclTax] = useState('0')
  const [amountTax, setAmountTax] = useState('0')

  useEffect(() => {
    const loadPeriods = async () => {
      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        setLoading(false)
        return
      }

      const { data, error: periodsError } = await client
        .from('service_charge_periods')
        .select('id, hall_id, label, period_end')
        .order('period_end', { ascending: false })

      if (periodsError) {
        setError(periodsError.message)
        setLoading(false)
        return
      }

      const options = (data ?? []) as AdminPeriodOption[]
      setPeriods(options)
      if (options[0]) {
        setSelectedPeriodId(options[0].id)
      }
      setLoading(false)
    }

    void loadPeriods()
  }, [])

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

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? null

  const totalCents = useMemo(
    () => rows.reduce((sum, row) => sum + Math.round(Number(row.amount_incl_tax) * 100), 0),
    [rows],
  )

  const onCreateCharge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPeriod) {
      setError('Aucune periode selectionnee.')
      return
    }

    const client = getSupabaseClient()
    if (!client) {
      setError('Supabase non configure.')
      return
    }

    const excl = Number.parseFloat(amountExclTax.replace(',', '.'))
    const tax = Number.parseFloat(amountTax.replace(',', '.'))
    if (!Number.isFinite(excl) || !Number.isFinite(tax) || excl < 0 || tax < 0) {
      setError('Montants invalides. Utilisez des nombres positifs.')
      return
    }

    const incl = Math.round((excl + tax) * 100) / 100

    setSaving(true)
    const { error: insertError } = await client.from('service_charges').insert({
      hall_id: selectedPeriod.hall_id,
      period_id: selectedPeriod.id,
      label: newLabel,
      category: newCategory,
      amount_excl_tax: excl,
      amount_tax: tax,
      amount_incl_tax: incl,
      source: 'manual',
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setNewLabel('')
    setAmountExclTax('0')
    setAmountTax('0')
    setError(null)
    setSaving(false)

    setLoadingRows(true)
    const { data, error: rowsError } = await client
      .from('service_charges')
      .select('id, label, category, amount_incl_tax')
      .eq('period_id', selectedPeriod.id)
      .order('label', { ascending: true })

    if (rowsError) {
      setError(rowsError.message)
      setLoadingRows(false)
      return
    }

    setRows((data ?? []) as AdminChargeRow[])
    setLoadingRows(false)
  }

  return (
    <PageContainer>
      {loading || loadingRows ? <StateMessage variant="loading" title="Chargement des frais admin..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}

      {!loading && !error ? (
        <Card title="Frais de service" subtitle={`Periode ${selectedPeriodLabel}`}>
          {periods.length > 0 ? (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-period-select">
                Mois a consulter
              </label>
              <select
                id="admin-period-select"
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
                className="brand-input max-w-sm"
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <form className="mb-5 grid gap-3 rounded-2xl border border-[#13223a17] bg-white/70 p-4 md:grid-cols-2" onSubmit={onCreateCharge}>
            <label className="block text-sm text-[#4d5562] md:col-span-2">
              Libelle
              <input
                className="brand-input mt-1"
                required
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
              />
            </label>

            <label className="block text-sm text-[#4d5562]">
              Categorie
              <input
                className="brand-input mt-1"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              />
            </label>

            <div />

            <label className="block text-sm text-[#4d5562]">
              Montant HT
              <input
                className="brand-input mt-1"
                inputMode="decimal"
                required
                value={amountExclTax}
                onChange={(event) => setAmountExclTax(event.target.value)}
              />
            </label>

            <label className="block text-sm text-[#4d5562]">
              TVA
              <input
                className="brand-input mt-1"
                inputMode="decimal"
                required
                value={amountTax}
                onChange={(event) => setAmountTax(event.target.value)}
              />
            </label>

            <div className="md:col-span-2">
              <button className="brand-button" disabled={saving || !selectedPeriodId} type="submit">
                {saving ? 'Ajout...' : 'Ajouter le frais'}
              </button>
            </div>
          </form>

          {rows.length === 0 ? (
            <StateMessage
              variant="empty"
              title="Aucun frais pour cette periode"
              message="Ajoutez ou importez des frais puis selectionnez la periode a consulter."
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
