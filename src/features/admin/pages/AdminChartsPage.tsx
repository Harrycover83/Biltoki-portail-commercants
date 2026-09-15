import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { formatEuroFromCents } from '../../../lib/money'
import { useAdminHall } from '../AdminHallContext'
import { adminChargeDate, getAdminCharges, type AdminChargeRow } from '../services/adminChargeService'

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
}

function amountCents(row: AdminChargeRow): number {
  return Math.round(Number(row.amount_incl_tax) * 100)
}

export function AdminChartsPage() {
  const { selectedHallId, loading: loadingHalls } = useAdminHall()
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [query, setQuery] = useState('')
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedHallId) {
        setRows([])
        return
      }

      setLoadingRows(true)
      const result = await getAdminCharges(selectedHallId)
      setRows(result.data ?? [])
      setError(result.error)
      setLoadingRows(false)
    }

    void loadRows()
  }, [selectedHallId])

  const searchTerm = normalizeSearch(deferredQuery)
  const matchingRows = useMemo(() => {
    if (!searchTerm) {
      return []
    }

    return rows
      .filter((row) => normalizeSearch(`${row.label} ${row.category ?? ''}`).includes(searchTerm))
      .sort((left, right) => adminChargeDate(left).localeCompare(adminChargeDate(right)))
  }, [rows, searchTerm])

  const chartData = useMemo(
    () => matchingRows.map((row) => ({
      id: row.id,
      date: DATE_FORMATTER.format(new Date(adminChargeDate(row))),
      montant: Number(row.amount_incl_tax),
      facture: row.label,
    })),
    [matchingRows],
  )

  const totalCents = matchingRows.reduce((total, row) => total + amountCents(row), 0)
  const averageCents = matchingRows.length > 0 ? Math.round(totalCents / matchingRows.length) : 0
  const loading = loadingHalls || loadingRows

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement des factures..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <Card
            title="Evolution des factures"
            subtitle="Recherchez un fournisseur, un poste ou une categorie sur toutes les annees."
          >
            <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="invoice-chart-search">
              Rechercher une facture
            </label>
            <input
              id="invoice-chart-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="brand-input"
              placeholder="Ex. EDF, electricite, assurance..."
              autoComplete="off"
            />
          </Card>

          {!searchTerm ? (
            <StateMessage
              variant="empty"
              title="Lancez une recherche"
              message="Saisissez un terme pour retrouver les factures correspondantes sur tout l'historique."
            />
          ) : null}

          {searchTerm && matchingRows.length === 0 ? (
            <StateMessage
              variant="empty"
              title="Aucune facture trouvee"
              message={`Aucun libelle ou categorie ne correspond a « ${deferredQuery.trim()} ».`}
            />
          ) : null}

          {matchingRows.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Factures trouvees" value={matchingRows.length.toLocaleString('fr-FR')} />
                <Metric label="Montant total" value={formatEuroFromCents(totalCents)} />
                <Metric label="Montant moyen" value={formatEuroFromCents(averageCents)} />
              </div>

              <Card
                title={`Evolution de « ${deferredQuery.trim()} »`}
                subtitle={`${matchingRows.length} facture(s), de ${chartData[0]?.date} a ${chartData.at(-1)?.date}`}
              >
                <div className="h-[360px] w-full" aria-label="Courbe d'evolution des montants TTC">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 18, left: 10, bottom: 8 }}>
                      <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: '#626a78', fontSize: 12 }} minTickGap={36} />
                      <YAxis
                        tick={{ fill: '#626a78', fontSize: 12 }}
                        tickFormatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                        width={82}
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatEuroFromCents(Math.round(Number(value) * 100)),
                          'Montant TTC',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="montant"
                        name="Montant TTC"
                        stroke="#d84d2c"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Factures correspondantes" subtitle="Classement chronologique, de la plus ancienne a la plus recente.">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#13223a1f] text-[#626a78]">
                        <th className="py-2">Date</th>
                        <th className="py-2">Poste</th>
                        <th className="py-2">Categorie</th>
                        <th className="py-2 text-right">Montant TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100/80 last:border-b-0">
                          <td className="whitespace-nowrap py-3 text-[#626a78]">
                            {new Date(adminChargeDate(row)).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-3">{row.label}</td>
                          <td className="py-3">{row.category ?? '-'}</td>
                          <td className="py-3 text-right font-semibold text-[#13223a]">
                            {formatEuroFromCents(amountCents(row))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-4 border-[#348b57] bg-[#fffcf6] px-5 py-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[#626a78]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#13223a]">{value}</p>
    </div>
  )
}