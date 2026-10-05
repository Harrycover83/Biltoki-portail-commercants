import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { Metric } from '@/components/ui/Metric'
import { StateMessage } from '@/components/ui/StateMessage'
import { formatEuroFromCents } from '@/lib/money'
import { openChargeDocument } from '@/lib/openChargeDocument'
import {
  amountCents,
  buildChartData,
  buildChartSeries,
  buildSupplierCatalog,
  filterSuppliers,
  selectChargeRows,
} from '@/features/admin/charts/chartData'
import { useAdminHall } from '@/features/admin/AdminHallContext'
import { useLiveAdminCharges } from '@/features/admin/hooks/useLiveAdminCharges'
import { adminChargeDate } from '@/features/admin/services/adminChargeService'

export function AdminChartsPage() {
  const { selectedHallId } = useAdminHall()
  // Le changement de halle remonte le contenu pour repartir d'un etat vide.
  return <AdminChartsPageContent key={selectedHallId} />
}

function AdminChartsPageContent() {
  const { selectedHallId, loading: loadingHalls } = useAdminHall()
  const { rows, loading: loadingRows, error, setError } = useLiveAdminCharges(selectedHallId)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)

  const suppliers = useMemo(() => buildSupplierCatalog(rows), [rows])
  const visibleSuppliers = useMemo(() => filterSuppliers(suppliers, catalogQuery), [catalogQuery, suppliers])
  const matchingRows = useMemo(() => selectChargeRows(rows, selectedSuppliers), [rows, selectedSuppliers])
  const chartSeries = useMemo(() => buildChartSeries(matchingRows), [matchingRows])
  const chartData = useMemo(() => buildChartData(matchingRows, chartSeries), [chartSeries, matchingRows])
  const totalCents = matchingRows.reduce((total, row) => total + amountCents(row), 0)
  const averageCents = matchingRows.length > 0 ? Math.round(totalCents / matchingRows.length) : 0
  const loading = loadingHalls || loadingRows
  const hasCriteria = rows.length > 0 || selectedSuppliers.length > 0
  const chartTitle = selectedSuppliers.length > 0
    ? `Evolution de ${selectedSuppliers.length} creancier(s) selectionne(s)`
    : 'Evolution de toutes les factures'

  const toggleSupplier = (supplierName: string) => {
    setSelectedSuppliers((current) => (
      current.includes(supplierName)
        ? current.filter((item) => item !== supplierName)
        : [...current, supplierName]
    ))
  }

  const openDocument = async (chargeId: string) => {
    setOpeningDocumentId(chargeId)
    setError(await openChargeDocument(chargeId))
    setOpeningDocumentId(null)
  }

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement des factures..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}

      {!loading && (!error || rows.length > 0) ? (
        <div className="space-y-6">
          <Card
            title="Evolution des factures"
            subtitle="Liste exhaustive des factures par creancier et par annee."
          >
            <div className="mt-0 border-t-0 pt-0">
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
              title="Aucune facture"
              message="Aucune facture n'est encore disponible pour cette halle."
            />
          ) : null}

          {hasCriteria && matchingRows.length === 0 ? (
            <StateMessage
              variant="empty"
              title="Aucune facture trouvee"
              message="Aucun creancier ne correspond a cette selection."
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
                <div className="h-[360px] w-full" aria-label="Courbes d'evolution des montants TTC par creancier">
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
                      <Legend />
                      {chartSeries.map((series, index) => (
                        <Line
                          key={series.dataKey}
                          type="monotone"
                          dataKey={series.dataKey}
                          name={series.name}
                          stroke={['#d84d2c', '#348b57', '#2468a8', '#9b5de5', '#d18b21'][index % 5]}
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      ))}
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
                        <th className="py-2 text-right">Facture</th>
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