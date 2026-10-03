import { useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { formatEuroFromCents } from '../../../lib/money'
import { openChargeDocument } from '../../../lib/openChargeDocument'
import { canSyncRole } from '../../../lib/roles'
import { useAuth } from '../../auth/AuthProvider'
import { useAdminHall } from '../AdminHallContext'
import { adminChargeDate, getAdminCharges, type AdminChargeRow } from '../services/adminChargeService'
import { PennylaneSyncPanel } from './PennylaneSyncPanel'

type MonthGroup = {
  month: string // '01'..'12'
  monthLabel: string
  charges: AdminChargeRow[]
  totalCents: number
}

type YearGroup = {
  year: string
  months: MonthGroup[]
  totalCents: number
}

type ChargeSort = 'date-asc' | 'amount-desc' | 'amount-asc'

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'long' })
function dateForGrouping(row: AdminChargeRow): string {
  return adminChargeDate(row)
}

function groupByYearMonth(rows: AdminChargeRow[]): YearGroup[] {
  const monthsByYear = new Map<string, Map<string, AdminChargeRow[]>>()

  for (const row of rows) {
    const isoDate = dateForGrouping(row)
    const year = isoDate.slice(0, 4)
    const month = isoDate.slice(5, 7)

    if (!monthsByYear.has(year)) {
      monthsByYear.set(year, new Map())
    }
    const monthMap = monthsByYear.get(year)!
    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }
    monthMap.get(month)!.push(row)
  }

  return [...monthsByYear.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, monthMap]) => {
      const months: MonthGroup[] = [...monthMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, monthRows]) => {
          const sorted = [...monthRows].sort((a, b) => dateForGrouping(a).localeCompare(dateForGrouping(b)))
          return {
            month,
            monthLabel: MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(Number(year), Number(month) - 1, 1))),
            charges: sorted,
            totalCents: sorted.reduce((sum, row) => sum + Math.round(Number(row.amount_incl_tax) * 100), 0),
          }
        })

      return {
        year,
        months,
        totalCents: months.reduce((sum, month) => sum + month.totalCents, 0),
      }
    })
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function AdminServiceChargesPage() {
  const { selectedHallId, loading: loadingHalls, syncVersion } = useAdminHall()
  const { role } = useAuth()
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [pickedYear, setPickedYear] = useState('')
  const [pickedMonth, setPickedMonth] = useState('')
  const [chargeSort, setChargeSort] = useState<ChargeSort>('date-asc')
  const [loadedHallId, setLoadedHallId] = useState<string | null>(null)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRows = Boolean(selectedHallId) && loadedHallId !== selectedHallId

  useEffect(() => {
    let cancelled = false

    const loadRows = async () => {
      if (!selectedHallId) {
        setRows([])
        return
      }

      const result = await getAdminCharges(selectedHallId)
      if (cancelled) {
        return
      }

      if (result.error) {
        setError(result.error)
      } else {
        setRows(result.data ?? [])
        setError(null)
      }
      setLoadedHallId(selectedHallId)
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [selectedHallId, syncVersion])

  const years = useMemo(() => groupByYearMonth(rows), [rows])

  const selectedYearGroup = useMemo(
    () => years.find((year) => year.year === pickedYear) ?? years[0] ?? null,
    [years, pickedYear],
  )
  const selectedYear = selectedYearGroup?.year ?? ''
  const selectedMonthGroup = useMemo(
    () => selectedYearGroup?.months.find((month) => month.month === pickedMonth) ?? selectedYearGroup?.months[0] ?? null,
    [selectedYearGroup, pickedMonth],
  )
  const selectedMonth = selectedMonthGroup?.month ?? ''
  const displayedCharges = useMemo(() => {
    if (!selectedMonthGroup) {
      return []
    }

    return [...selectedMonthGroup.charges].sort((left, right) => {
      if (chargeSort === 'amount-desc') {
        return Number(right.amount_incl_tax) - Number(left.amount_incl_tax)
      }
      if (chargeSort === 'amount-asc') {
        return Number(left.amount_incl_tax) - Number(right.amount_incl_tax)
      }
      return dateForGrouping(left).localeCompare(dateForGrouping(right))
    })
  }, [chargeSort, selectedMonthGroup])

  // Une selection vide ou obsolete retombe sur le mois le plus recent.
  const onYearChange = (year: string) => {
    setPickedYear(year)
    setPickedMonth('')
  }

  const openDocument = async (chargeId: string) => {
    setOpeningDocumentId(chargeId)
    setError(await openChargeDocument(chargeId))
    setOpeningDocumentId(null)
  }

  return (
    <PageContainer>
      {canSyncRole(role) ? (
        <div className="mb-4 flex justify-end">
          <PennylaneSyncPanel />
        </div>
      ) : null}
      {loadingHalls || loadingRows ? <StateMessage variant="loading" title="Chargement des charges communes..." /> : null}
      {!loadingHalls && !loadingRows && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loadingHalls && !loadingRows && !error && years.length === 0 ? (
        <StateMessage
          variant="empty"
          title="Aucune charge commune"
          message="Aucune charge synchronisee depuis Pennylane pour cette halle. Lancez une synchronisation."
        />
      ) : null}

      {!loadingHalls && !loadingRows && !error && years.length > 0 ? (
        <div className="space-y-6">
          <Card title="Charges communes" subtitle="Source unique: Pennylane. Vue en lecture, alimentee par la synchronisation Pennylane.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-year-select">
                  Annee
                </label>
                <select
                  id="admin-year-select"
                  value={selectedYear}
                  onChange={(event) => onYearChange(event.target.value)}
                  className="brand-input"
                >
                  {years.map((year) => (
                    <option key={year.year} value={year.year}>
                      {year.year} ({formatEuroFromCents(year.totalCents)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedYearGroup ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-month-select">
                    Mois
                  </label>
                  <select
                    id="admin-month-select"
                    value={selectedMonth}
                    onChange={(event) => setPickedMonth(event.target.value)}
                    className="brand-input"
                  >
                    {selectedYearGroup.months.map((month) => (
                      <option key={month.month} value={month.month}>
                        {month.monthLabel} ({formatEuroFromCents(month.totalCents)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="admin-charge-sort">
                  Affichage
                </label>
                <select
                  id="admin-charge-sort"
                  value={chargeSort}
                  onChange={(event) => setChargeSort(event.target.value as ChargeSort)}
                  className="brand-input"
                >
                  <option value="date-asc">Date, du plus ancien au plus recent</option>
                  <option value="amount-desc">Montant, du plus eleve au plus faible</option>
                  <option value="amount-asc">Montant, du plus faible au plus eleve</option>
                </select>
              </div>
            </div>
          </Card>

          {selectedMonthGroup ? (
            <Card
              title={capitalize(selectedMonthGroup.monthLabel)}
              subtitle={`${selectedMonthGroup.charges.length} facture(s) - Total ${formatEuroFromCents(selectedMonthGroup.totalCents)}`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#13223a1f] text-[#626a78]">
                      <th className="py-2">Date</th>
                      <th className="py-2">Poste</th>
                      <th className="py-2">Categorie</th>
                      <th className="py-2 text-right">Montant TTC</th>
                      <th className="py-2 text-right">Justificatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCharges.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100/80 last:border-b-0">
                        <td className="py-3 whitespace-nowrap text-[#626a78]">
                          {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="py-3">{row.label}</td>
                        <td className="py-3">{row.category ?? '-'}</td>
                        <td className="py-3 text-right font-semibold text-[#13223a]">
                          {formatEuroFromCents(Math.round(Number(row.amount_incl_tax) * 100))}
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

              <p className="mt-4 text-right text-sm font-semibold text-[#13223a]">
                Total mois: {formatEuroFromCents(selectedMonthGroup.totalCents)}
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  )
}
