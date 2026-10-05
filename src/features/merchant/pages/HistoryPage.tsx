import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { PageContainer } from '@/components/layout/PageContainer'
import { StateMessage } from '@/components/ui/StateMessage'
import { capitalize } from '@/lib/format'
import { formatEuroFromCents } from '@/lib/money'
import { openChargeDocument } from '@/lib/openChargeDocument'
import { getMerchantChargesByYear, getMerchantHallOptions } from '@/features/merchant/services/merchantService'
import type { MerchantHallOption, MerchantYearGroup } from '@/types/domain'

export function HistoryPage() {
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [years, setYears] = useState<MerchantYearGroup[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [sortOrder, setSortOrder] = useState<'chronological' | 'amount'>('chronological')
  const [loading, setLoading] = useState(true)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHalls = async () => {
      const hallsResult = await getMerchantHallOptions()
      if (hallsResult.error) {
        setError(hallsResult.error)
        setLoading(false)
        return
      }

      const options = hallsResult.data ?? []
      setHalls(options)
      setSelectedHallId(options[0]?.hallId ?? '')

      if (!options[0]) {
        setLoading(false)
      }
    }

    void loadHalls()
  }, [])

  useEffect(() => {
    const loadCharges = async () => {
      if (!selectedHallId) {
        setYears([])
        return
      }

      setLoading(true)
      const result = await getMerchantChargesByYear(selectedHallId)
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      const loadedYears = result.data ?? []
      setYears(loadedYears)
      setSelectedYear(loadedYears[0]?.year ?? '')
      setSelectedMonth(loadedYears[0]?.months[0]?.month ?? '')
      setError(null)
      setLoading(false)
    }

    void loadCharges()
  }, [selectedHallId])

  const selectedYearGroup = useMemo(
    () => years.find((year) => year.year === selectedYear) ?? null,
    [years, selectedYear],
  )

  const selectedMonthGroup = useMemo(
    () => selectedYearGroup?.months.find((month) => month.month === selectedMonth) ?? null,
    [selectedYearGroup, selectedMonth],
  )

  const sortedCharges = useMemo(() => {
    const charges = [...(selectedMonthGroup?.charges ?? [])]
    if (sortOrder === 'amount') {
      return charges.sort((left, right) => right.totalCents - left.totalCents)
    }

    return charges.sort((left, right) => (
      (right.invoiceDate ?? '').localeCompare(left.invoiceDate ?? '')
    ))
  }, [selectedMonthGroup, sortOrder])

  const onYearChange = (year: string) => {
    setSelectedYear(year)
    const yearGroup = years.find((y) => y.year === year)
    setSelectedMonth(yearGroup?.months[0]?.month ?? '')
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
      {!loading && !error && years.length === 0 ? (
        <StateMessage
          variant="empty"
          title="Aucune facture"
          message="Aucune facture disponible pour le moment."
        />
      ) : null}

      {!loading && !error && years.length > 0 ? (
        <div className="space-y-6">
          <Card title="Historique des factures" subtitle="Charges communes refacturées, par année et par mois">
            <div className="grid gap-4 sm:grid-cols-3">
              {halls.length > 1 ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="history-hall-select">
                    Halle
                  </label>
                  <select
                    id="history-hall-select"
                    value={selectedHallId}
                    onChange={(event) => setSelectedHallId(event.target.value)}
                    className="brand-input"
                  >
                    {halls.map((hall) => (
                      <option key={hall.hallId} value={hall.hallId}>
                        {hall.hallName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="history-year-select">
                  Annee
                </label>
                <select
                  id="history-year-select"
                  value={selectedYear}
                  onChange={(event) => onYearChange(event.target.value)}
                  className="brand-input"
                >
                  {years.map((year) => (
                    <option key={year.year} value={year.year}>
                      {year.year} ({formatEuroFromCents(year.totalChargesCents)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedYearGroup ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="history-month-select">
                    Mois
                  </label>
                  <select
                    id="history-month-select"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="brand-input"
                  >
                    {selectedYearGroup.months.map((month) => (
                      <option key={month.month} value={month.month}>
                        {month.monthLabel} ({formatEuroFromCents(month.totalChargesCents)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="history-sort-select">
                  Trier les factures
                </label>
                <select
                  id="history-sort-select"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as 'chronological' | 'amount')}
                  className="brand-input"
                >
                  <option value="chronological">Plus recentes d&apos;abord</option>
                  <option value="amount">Montant décroissant</option>
                </select>
              </div>
            </div>
          </Card>

          {selectedMonthGroup ? (
            <Card
              title={capitalize(selectedMonthGroup.monthLabel)}
              subtitle={`${selectedMonthGroup.charges.length} facture(s) - Total ${formatEuroFromCents(selectedMonthGroup.totalChargesCents)}`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#13223a1f] text-[#626a78]">
                      <th className="py-2">Date</th>
                      <th className="py-2">Facture</th>
                      <th className="py-2">Catégorie</th>
                      <th className="py-2 text-right">Montant TTC</th>
                      <th className="py-2 text-right">Justificatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCharges.map((charge) => (
                      <tr key={charge.id} className="border-b border-slate-100/80 last:border-b-0">
                        <td className="py-3 whitespace-nowrap text-[#626a78]">
                          {charge.invoiceDate
                            ? new Date(charge.invoiceDate).toLocaleDateString('fr-FR')
                            : '-'}
                        </td>
                        <td className="py-3">{charge.label}</td>
                        <td className="py-3">{charge.category ?? '-'}</td>
                        <td className="py-3 text-right font-semibold text-[#13223a]">
                          {formatEuroFromCents(charge.totalCents)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            className="rounded border border-[#13223a33] px-2 py-1 text-xs font-semibold text-[#13223a] hover:bg-[#13223a0f] disabled:opacity-50"
                            disabled={openingDocumentId === charge.id}
                            onClick={() => void openDocument(charge.id)}
                          >
                            {openingDocumentId === charge.id ? 'Ouverture...' : 'Ouvrir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  )
}
