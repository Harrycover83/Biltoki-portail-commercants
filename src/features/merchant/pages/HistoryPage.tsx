import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { StateMessage } from '../../../components/ui/StateMessage'
import { formatEuroFromCents } from '../../../lib/money'
import { getMerchantChargesByYear, getMerchantHallOptions } from '../services/merchantService'
import type { MerchantHallOption, MerchantYearGroup } from '../../../types/domain'

export function HistoryPage() {
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [years, setYears] = useState<MerchantYearGroup[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(true)
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

  const onYearChange = (year: string) => {
    setSelectedYear(year)
    const yearGroup = years.find((y) => y.year === year)
    setSelectedMonth(yearGroup?.months[0]?.month ?? '')
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
          <Card title="Historique des factures" subtitle="Charges communes refacturees, par annee et par mois">
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
                        {month.monthLabel}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
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
                      <th className="py-2">Categorie</th>
                      <th className="py-2 text-right">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMonthGroup.charges.map((charge) => (
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
