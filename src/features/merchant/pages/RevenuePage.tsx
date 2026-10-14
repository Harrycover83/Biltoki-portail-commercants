import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { StateMessage } from '@/components/ui/StateMessage'
import { parisToday } from '@/features/admin/dashboard/revenue'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  deleteDeclaredRevenue,
  getDeclaredRevenue,
  saveDeclaredRevenue,
} from '@/features/merchant/services/merchantRevenueService'
import { formatMonthKey } from '@/lib/format'
import { centsToEuroInput, formatEuroFromCents, parseEuroInput } from '@/lib/money'

type Loaded = { key: string; declared?: Map<string, number>; error?: string }

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

export function RevenuePage() {
  const { profile } = useAuth()
  const merchantId = profile?.merchant_id ?? null
  const today = parisToday()
  const currentYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<Loaded | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingMonth, setSavingMonth] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const key = `${merchantId}:${reload}`

  useEffect(() => {
    if (!merchantId) return
    let cancelled = false
    void getDeclaredRevenue().then(({ data, error }) => {
      if (!cancelled) setResult(error || !data ? { key, error: error ?? 'Impossible de charger les déclarations.' } : { key, declared: data })
    })
    return () => { cancelled = true }
  }, [key, merchantId])

  const loaded = result?.key === key ? result : null
  const declared = loaded?.declared

  // Months that have started: a month can only be declared once it is under way.
  const months = useMemo(() => {
    const last = year === currentYear ? Number(today.slice(5, 7)) : 12
    return Array.from({ length: last }, (_, index) => monthKey(year, index + 1))
  }, [currentYear, today, year])

  // The curve covers the whole history, whatever year is open in the entry table.
  const chartData = useMemo(
    () => [...(declared?.entries() ?? [])]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cents]) => ({ month: formatMonthKey(month), amount: cents / 100 })),
    [declared],
  )

  const draftFor = (month: string) => drafts[month] ?? (declared?.has(month) ? centsToEuroInput(declared.get(month)!) : '')

  const save = useCallback(async (month: string) => {
    if (!merchantId || !declared) return
    const text = (drafts[month] ?? '').trim()
    setSaveError(null)
    setSavingMonth(month)
    const failure = text === ''
      ? await deleteDeclaredRevenue(merchantId, month)
      : await saveDeclaredRevenue(merchantId, month, parseEuroInput(text)!)
    setSavingMonth(null)
    if (failure) {
      setSaveError(failure)
      return
    }
    setDrafts((current) => {
      const next = { ...current }
      delete next[month]
      return next
    })
    setReload((version) => version + 1)
  }, [declared, drafts, merchantId])

  const years = [currentYear, currentYear - 1, currentYear - 2]

  if (!merchantId) {
    return (
      <PageContainer>
        <StateMessage
          variant="empty"
          title="Aucun commerce rattaché"
          message="Ce compte n’est lié à aucun commerce : la déclaration du chiffre d’affaires est indisponible."
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card
          title="Mon CA mensuel"
          subtitle="Renseignez le CA de chaque mois : vos déclarations sont conservées et alimentent la courbe ci-dessous. Un champ vide supprime la déclaration du mois."
        >
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="declared-year" className="text-sm font-semibold">Année</label>
            <select
              id="declared-year"
              value={year}
              onChange={(event) => { setYear(Number(event.target.value)); setDrafts({}); setSaveError(null) }}
              className="brand-input w-28"
            >
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>

          {!loaded ? <p role="status">Chargement des déclarations…</p>
            : loaded.error || !declared ? <p role="alert" className="border border-[#d84d2c] bg-[#fdeee9] p-3">{loaded.error}</p>
            : (
              <>
                {saveError && <p role="alert" className="mb-3 border border-[#d84d2c] bg-[#fdeee9] p-3">{saveError}</p>}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#13223a1f] text-[#626a78]">
                        <th className="py-2">Mois</th>
                        <th className="py-2 text-right">CA déclaré (€)</th>
                        <th className="py-2 text-right"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((month) => {
                        const draft = draftFor(month)
                        const draftCents = draft.trim() === '' ? null : parseEuroInput(draft)
                        const valid = draft.trim() === '' || draftCents !== null
                        const dirty = draftCents !== (declared.get(month) ?? null)
                        return (
                          <tr key={month} className="border-b border-slate-100/80 last:border-b-0">
                            <td className="py-3 text-[#171511]">{formatMonthKey(month)}</td>
                            <td className="py-2 text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Non déclaré"
                                value={draft}
                                onChange={(event) => setDrafts((current) => ({ ...current, [month]: event.target.value }))}
                                aria-invalid={!valid}
                                className="brand-input w-36 text-right"
                                aria-label={`CA pour ${formatMonthKey(month)}`}
                              />
                              {!valid && <p className="mt-1 text-xs text-[#d84d2c]">Montant invalide (2 décimales max).</p>}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                disabled={!dirty || !valid || savingMonth !== null}
                                onClick={() => void save(month)}
                                className="text-sm font-bold underline disabled:opacity-30"
                                aria-label={`Enregistrer ${formatMonthKey(month)}`}
                              >
                                {savingMonth === month ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
        </Card>

        {declared && (
          <Card title="Évolution de mon CA" subtitle="Tous les mois déclarés, toutes années confondues.">
            {chartData.length === 0 ? (
              <p role="status">Aucun mois déclaré pour le moment : la courbe apparaîtra dès votre première saisie.</p>
            ) : (
              <div className="h-[320px] w-full" aria-label="Courbe d'évolution du chiffre d'affaires mensuel déclaré">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fill: '#626a78', fontSize: 12 }} minTickGap={18} />
                    <YAxis
                      tick={{ fill: '#626a78', fontSize: 12 }}
                      tickFormatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                      width={82}
                    />
                    <Tooltip
                      formatter={(value) => [formatEuroFromCents(Math.round(Number(value) * 100)), 'CA déclaré']}
                      labelStyle={{ color: '#171511' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="CA"
                      stroke="#348b57"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )}
      </div>
    </PageContainer>
  )
}
