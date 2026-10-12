import { useEffect, useState, type FormEvent } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { useAdminHall } from '@/features/admin/AdminHallContext'
import { defaultRevenuePeriod, fetchRevenue, parisToday, type RevenueComparison } from '@/features/admin/dashboard/revenue'
import { formatEuroFromCents } from '@/lib/money'
import { formatDateTime } from '@/lib/format'

const money = (value: number | null) => value === null ? 'Indisponible' : formatEuroFromCents(value)
const dateLabel = (value: string) => value.split('-').reverse().join('/')

type LoadResult = { key: string; data?: RevenueComparison; error?: string }

function RevenuePanel({ hallId, since, until, refresh }: { hallId: string; since: string; until: string; refresh: number }) {
  const key = `${hallId}:${since}:${until}:${refresh}`
  const [result, setResult] = useState<LoadResult | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetchRevenue(hallId, since, until, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data }) },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ key, error: error instanceof Error ? error.message : 'Impossible de charger le CA Popina.' })
        }
      },
    )
    return () => controller.abort()
  }, [hallId, since, until, key])

  if (result?.key !== key) return <p role="status">Chargement du CA Popina et de l’historique N‑1…</p>
  if (result.error) return <p role="alert" className="border border-[#d84d2c] bg-[#fdeee9] p-4">{result.error}</p>
  const data = result.data
  if (!data) return null
  const currentDays = data.daily.filter((day) => day.currentCents !== null).length
  const previousDays = data.daily.filter((day) => day.previousCents !== null).length
  const chartData = data.daily.map((day) => ({
    day: dateLabel(day.date), current: day.currentCents, previous: day.previousCents,
  }))
  return (
    <div className="space-y-6">
      <p className="text-sm text-[#615b51]">
        Source : Popina · CA TTC des clôtures, rattaché au jour d’ouverture de la session (Europe/Paris).
        Dernière lecture : {formatDateTime(data.fetchedAt)}.
      </p>
      <section aria-label="Indicateurs de chiffre d’affaires" className="grid gap-4 md:grid-cols-3">
        <Card title="CA de la période">
          <p className="brand-display text-3xl">{money(data.totalCurrentCents)}</p>
          <p className="mt-2 text-sm">{currentDays} / {data.daily.length} jours avec des rapports</p>
        </Card>
        <Card title="CA N‑1">
          <p className="brand-display text-3xl">{money(data.totalPreviousCents)}</p>
          <p className="mt-2 text-sm">{previousDays} / {data.daily.length} jours avec des rapports</p>
        </Card>
        <Card title="Tendance N‑1">
          <p className="brand-display text-3xl">
            {data.trendPercent === null ? 'Non calculable' : `${data.trendPercent > 0 ? '+' : ''}${data.trendPercent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
          </p>
          <p className="mt-2 text-sm">{data.comparableDays} jours comparables aux mêmes dates de N‑1.</p>
          {data.comparableDays > 0 && <p className="mt-1 text-xs">
            {money(data.comparableCurrentCents)} contre {money(data.comparablePreviousCents)}.
          </p>}
        </Card>
      </section>
      <p className="text-sm text-[#615b51]">
        Un jour sans rapport reste indisponible, pas à zéro. La tendance utilise uniquement les dates présentes
        dans les deux années ; elle n’est pas calculée si le CA N‑1 comparable est nul ou négatif.
        Le 29 février n’a pas de date comparable dans une année non bissextile.
      </p>
      {currentDays === 0 && <p role="status">Aucun rapport de clôture disponible pour cette période.</p>}
      {(currentDays > 0 || previousDays > 0) && <Card title="Évolution quotidienne du CA" subtitle="Mêmes dates de l’année précédente, sans alignement des jours de la semaine.">
        <div className="h-[300px]" aria-label="Courbes du CA et du CA N‑1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value: number) => formatEuroFromCents(value)} width={100} />
              <Tooltip formatter={(value) => typeof value === 'number' ? formatEuroFromCents(value) : 'Indisponible'} />
              <Legend />
              <Line dataKey="current" name="CA période" stroke="#348b57" connectNulls={false} />
              <Line dataKey="previous" name="CA N‑1" stroke="#2468a8" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">CA quotidien et dates comparées</caption>
            <thead><tr><th className="p-2">Date</th><th className="p-2">CA TTC</th><th className="p-2">Date N‑1</th><th className="p-2">CA TTC N‑1</th></tr></thead>
            <tbody>{data.daily.map((day) => <tr key={day.date} className="border-t border-[#e4ddd1]">
              <td className="p-2">{dateLabel(day.date)}</td><td className="p-2">{money(day.currentCents)}</td>
              <td className="p-2">{day.previousDate ? dateLabel(day.previousDate) : 'Sans équivalent'}</td>
              <td className="p-2">{money(day.previousCents)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Card>}
    </div>
  )
}

export function AdminDashboardPage() {
  const { selectedHallId, halls, loading } = useAdminHall()
  const [period, setPeriod] = useState(defaultRevenuePeriod)
  const [draft, setDraft] = useState(period)
  const [refresh, setRefresh] = useState(0)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const hall = halls.find((option) => option.id === selectedHallId)

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const days = (Date.parse(draft.until) - Date.parse(draft.since)) / 86_400_000
    if (!draft.since || !draft.until || !Number.isFinite(days) || days < 0 || days >= 93 || draft.until >= parisToday()) {
      setPeriodError('Choisissez une période passée de 1 à 93 jours.')
      return
    }
    setPeriodError(null)
    setPeriod(draft)
    setRefresh((version) => version + 1)
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <h1 className="brand-title text-2xl">Dashboard{hall ? ` · ${hall.name}` : ''}</h1>
        <p className="text-sm text-[#615b51]">Pilote Popina : Toulon uniquement. Aucune donnée fictive n’est affichée.</p>
        <Card title="Chiffre d’affaires et comparatif N‑1">
          <form onSubmit={applyPeriod} className="flex flex-wrap items-end gap-4">
            <label className="text-sm">Du
              <input type="date" aria-label="Début de période" required value={draft.since} max={draft.until}
                onChange={(event) => setDraft({ ...draft, since: event.target.value })} className="ml-2 border p-2" />
            </label>
            <label className="text-sm">Au
              <input type="date" aria-label="Fin de période" required value={draft.until} min={draft.since}
                max={new Date(Date.parse(parisToday()) - 86_400_000).toISOString().slice(0, 10)}
                onChange={(event) => setDraft({ ...draft, until: event.target.value })} className="ml-2 border p-2" />
            </label>
            <button type="submit" className="border border-[#171511] px-4 py-2 text-sm font-bold">Afficher / actualiser</button>
          </form>
          {periodError && <p role="alert" className="mt-3 text-[#d84d2c]">{periodError}</p>}
        </Card>
        {loading ? <p role="status">Chargement des halles…</p> : hall ?
          <RevenuePanel hallId={hall.id} since={period.since} until={period.until} refresh={refresh} /> :
          <p role="alert">Aucune halle accessible sélectionnée.</p>}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card title="RH" subtitle="Skello non connecté"><p className="text-sm">Indicateurs indisponibles.</p></Card>
          <Card title="Finances" subtitle="Synthèse non connectée"><p className="text-sm">Les factures restent accessibles dans Charges communes.</p></Card>
          <Card title="Stock" subtitle="Suivi non activé"><p className="text-sm">Un inventaire physique initial et la correspondance produits / recettes seront nécessaires avant de déduire les ventes Popina.</p></Card>
          <Card title="Organisation" subtitle="Notion non connecté"><p className="text-sm">Aucune tâche ni alerte fictive.</p></Card>
        </div>
      </div>
    </PageContainer>
  )
}
