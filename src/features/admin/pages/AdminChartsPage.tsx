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
import { getBackendUrl } from '../../../lib/env'
import { formatEuroFromCents } from '../../../lib/money'
import { getSupabaseClient } from '../../../lib/supabase'
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
  const [catalogQuery, setCatalogQuery] = useState('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    setSelectedSuppliers([])

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
  const suppliers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.supplier_name) {
        counts.set(row.supplier_name, (counts.get(row.supplier_name) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name, 'fr-FR'))
  }, [rows])
  const visibleSuppliers = useMemo(() => {
    const term = normalizeSearch(catalogQuery)
    if (!term) {
      return suppliers
    }
    return suppliers.filter(({ name }) => normalizeSearch(name).includes(term))
  }, [catalogQuery, suppliers])

  const matchingRows = useMemo(() => {
    if (!searchTerm && selectedSuppliers.length === 0) {
      return []
    }

    return rows
      .filter((row) => (
        (searchTerm && normalizeSearch(`${row.supplier_name ?? ''} ${row.label} ${row.category ?? ''}`).includes(searchTerm))
        || (row.supplier_name !== null && selectedSuppliers.includes(row.supplier_name))
      ))
      .sort((left, right) => adminChargeDate(left).localeCompare(adminChargeDate(right)))
  }, [rows, searchTerm, selectedSuppliers])

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
  const hasCriteria = Boolean(searchTerm) || selectedSuppliers.length > 0
  const chartTitle = searchTerm
    ? `Evolution de « ${deferredQuery.trim()} »${selectedSuppliers.length > 0 ? ` et ${selectedSuppliers.length} creancier(s)` : ''}`
    : `Evolution de ${selectedSuppliers.length} creancier(s) selectionne(s)`

  const toggleSupplier = (supplierName: string) => {
    setSelectedSuppliers((current) => (
      current.includes(supplierName)
        ? current.filter((item) => item !== supplierName)
        : [...current, supplierName]
    ))
  }

  const openDocument = async (chargeId: string) => {
    const backendUrl = getBackendUrl()
    const client = getSupabaseClient()
    if (!backendUrl || !client) {
      setError('Service de documents non configure.')
      return
    }

    const documentWindow = window.open('', '_blank')
    if (!documentWindow) {
      setError('Autorisez les fenetres pop-up pour ouvrir le justificatif.')
      return
    }

    setOpeningDocumentId(chargeId)
    try {
      const {
        data: { session },
      } = await client.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Session admin introuvable, reconnectez-vous.')
      }

      const response = await fetch(`${backendUrl}/api/service-charges/${chargeId}/document`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Justificatif indisponible (HTTP ${response.status})`)
      }

      const documentUrl = URL.createObjectURL(await response.blob())
      documentWindow.location.replace(documentUrl)
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000)
      setError(null)
    } catch (documentError) {
      documentWindow.close()
      setError(documentError instanceof Error ? documentError.message : 'Justificatif indisponible.')
    } finally {
      setOpeningDocumentId(null)
    }
  }

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

            <div className="mt-5 border-t border-[#e4ddd1] pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="invoice-catalog-search">
                    Liste de tous les creanciers
                  </label>
                  <input
                    id="invoice-catalog-search"
                    type="search"
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    className="brand-input"
                    placeholder="Filtrer la liste..."
                    autoComplete="off"
                  />
                </div>
                {selectedSuppliers.length > 0 ? (
                  <button
                    type="button"
                    className="rounded border border-[#13223a33] px-3 py-2 text-sm font-semibold text-[#13223a] hover:bg-[#13223a0f]"
                    onClick={() => setSelectedSuppliers([])}
                  >
                    Effacer la selection ({selectedSuppliers.length})
                  </button>
                ) : null}
              </div>

              <div className="mt-3 max-h-64 overflow-y-auto border border-[#e4ddd1] bg-white">
                {visibleSuppliers.map(({ name, count }) => (
                  <label
                    key={name}
                    className="flex cursor-pointer items-start gap-3 border-b border-[#e4ddd1] px-3 py-2.5 last:border-b-0 hover:bg-[#f7e7b8]/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(name)}
                      onChange={() => toggleSupplier(name)}
                      className="mt-0.5 h-4 w-4 accent-[#348b57]"
                    />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-[#171511]">{name}</span>
                    <span className="whitespace-nowrap text-xs font-semibold text-[#626a78]">
                      {count} facture(s)
                    </span>
                  </label>
                ))}
                {visibleSuppliers.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[#626a78]">
                    {suppliers.length === 0
                      ? 'Aucun creancier renseigne. Lancez un backfill historique apres la migration.'
                      : 'Aucun creancier ne correspond a ce filtre.'}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          {!hasCriteria ? (
            <StateMessage
              variant="empty"
              title="Lancez une recherche ou choisissez des creanciers"
              message="Utilisez la saisie libre ou cochez un ou plusieurs creanciers dans la liste."
            />
          ) : null}

          {hasCriteria && matchingRows.length === 0 ? (
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
                title={chartTitle}
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
                        <th className="py-2">Creancier</th>
                        <th className="py-2">Poste</th>
                        <th className="py-2">Categorie</th>
                        <th className="py-2 text-right">Montant TTC</th>
                        <th className="py-2 text-right">Justificatif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100/80 last:border-b-0">
                          <td className="whitespace-nowrap py-3 text-[#626a78]">
                            {new Date(adminChargeDate(row)).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-3 font-semibold">{row.supplier_name ?? '-'}</td>
                          <td className="py-3">{row.label}</td>
                          <td className="py-3">{row.category ?? '-'}</td>
                          <td className="py-3 text-right font-semibold text-[#13223a]">
                            {formatEuroFromCents(amountCents(row))}
                          </td>
                          <td className="py-3 text-right">
                            {row.pennylane_id ? (
                              <button
                                type="button"
                                className="rounded border border-[#13223a33] px-2 py-1 text-xs font-semibold text-[#13223a] hover:bg-[#13223a0f] disabled:opacity-50"
                                disabled={openingDocumentId === row.id}
                                onClick={() => void openDocument(row.id)}
                              >
                                {openingDocumentId === row.id ? 'Ouverture...' : 'Ouvrir'}
                              </button>
                            ) : (
                              '-'
                            )}
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