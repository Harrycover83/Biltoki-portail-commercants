import { useEffect, useMemo, useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { StateMessage } from '@/components/ui/StateMessage'
import { formatEuroFromCents } from '@/lib/money'
import { capitalize } from '@/lib/format'
import { groupByYearMonth } from '@/lib/grouping'
import { canSyncRole } from '@/lib/roles'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAdminHall } from '@/features/admin/AdminHallContext'
import { adminChargeDate, getAdminCharges, type AdminChargeRow } from '@/features/admin/services/adminChargeService'
import { ChargeDocumentButton } from '@/features/admin/components/ChargeDocumentButton'
import { ChargePeriodComparison } from '@/features/admin/components/ChargePeriodComparison'
import { PennylaneSyncPanel } from '@/features/admin/components/PennylaneSyncPanel'
import { SupplierHistoryPanel } from '@/features/admin/components/SupplierHistoryPanel'
import { chargeCents } from '@/features/admin/charges/chargeComparison'

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
type ChargeView = 'invoices' | 'compare' | 'supplier'

const VIEW_TABS: { view: ChargeView; label: string }[] = [
  { view: 'invoices', label: 'Factures' },
  { view: 'compare', label: 'Comparer des périodes' },
  { view: 'supplier', label: 'Par fournisseur' },
]

function groupCharges(rows: AdminChargeRow[]): YearGroup[] {
  return groupByYearMonth(rows, adminChargeDate).map(({ year, months }) => {
    const monthGroups: MonthGroup[] = months.map(({ month, monthLabel, items }) => ({
      month,
      monthLabel,
      charges: items,
      totalCents: items.reduce((sum, row) => sum + chargeCents(row), 0),
    }))

    return {
      year,
      months: monthGroups,
      totalCents: monthGroups.reduce((sum, month) => sum + month.totalCents, 0),
    }
  })
}

export function AdminServiceChargesPage() {
  const { selectedHallId, loading: loadingHalls, syncVersion } = useAdminHall()
  const { role } = useAuth()
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [pickedYear, setPickedYear] = useState('')
  const [pickedMonth, setPickedMonth] = useState('')
  const [chargeSort, setChargeSort] = useState<ChargeSort>('date-asc')
  const [loadedHallId, setLoadedHallId] = useState<string | null>(null)
  const [view, setView] = useState<ChargeView>('invoices')
  const [focusedSupplier, setFocusedSupplier] = useState<string | null>(null)
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

  const years = useMemo(() => groupCharges(rows), [rows])

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
      return adminChargeDate(left).localeCompare(adminChargeDate(right))
    })
  }, [chargeSort, selectedMonthGroup])

  // Une selection vide ou obsolete retombe sur le mois le plus recent.
  const onYearChange = (year: string) => {
    setPickedYear(year)
    setPickedMonth('')
  }

  const showSupplier = (supplier: string) => {
    setFocusedSupplier(supplier)
    setView('supplier')
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
          message="Aucune charge synchronisée depuis Pennylane pour cette halle. Lancez une synchronisation."
        />
      ) : null}

      {!loadingHalls && !loadingRows && !error && years.length > 0 ? (
        <div className="space-y-6">
          <div role="tablist" aria-label="Vues des charges communes" className="flex flex-wrap gap-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.view}
                type="button"
                role="tab"
                aria-selected={view === tab.view}
                onClick={() => setView(tab.view)}
                className={
                  view === tab.view
                    ? 'rounded-full bg-[#348b57] px-4 py-2 text-sm font-semibold text-white'
                    : 'rounded-full border border-[#d6cebf] px-4 py-2 text-sm font-semibold text-[#171511] hover:bg-[#f7e7b8]'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {view === 'compare' ? <ChargePeriodComparison rows={rows} onSelectSupplier={showSupplier} /> : null}
          {view === 'supplier' ? (
            <SupplierHistoryPanel
              rows={rows}
              supplier={focusedSupplier}
              onSelectSupplier={setFocusedSupplier}
              onError={setError}
            />
          ) : null}

          {view === 'invoices' ? (
            <>
              <Card title="Charges communes" subtitle="Source unique : Pennylane. Vue en lecture, alimentée par la synchronisation Pennylane.">
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
                      <option value="date-asc">Date, du plus ancien au plus récent</option>
                      <option value="amount-desc">Montant, du plus élevé au plus faible</option>
                      <option value="amount-asc">Montant, du plus faible au plus élevé</option>
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
                          <th className="py-2">Fournisseur</th>
                          <th className="py-2">Catégorie</th>
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
                            <td className="py-3">
                              {row.supplier_name ? (
                                <button
                                  type="button"
                                  className="text-left underline decoration-dotted underline-offset-2 hover:text-[#d84d2c]"
                                  title="Voir l'historique de ce fournisseur"
                                  onClick={() => showSupplier(row.supplier_name as string)}
                                >
                                  {row.supplier_name}
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3">{row.category ?? '-'}</td>
                            <td className="py-3 text-right font-semibold text-[#13223a]">
                              {formatEuroFromCents(chargeCents(row))}
                            </td>
                            <td className="py-3 text-right">
                              {row.pennylane_id ? <ChargeDocumentButton chargeId={row.id} onError={setError} /> : '-'}
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
            </>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  )
}
