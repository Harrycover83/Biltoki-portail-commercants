import { useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getSupabaseClient } from '../../../lib/supabase'
import { formatEuroFromCents } from '../../../lib/money'
import { getBackendUrl } from '../../../lib/env'
import { useAdminHall } from '../AdminHallContext'

type AdminChargeRow = {
  id: string
  label: string
  category: string | null
  amount_incl_tax: number
  pennylane_id: string | null
  invoice_date: string | null
  period_end: string
  created_at: string
}

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

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const CHARGES_PAGE_SIZE = 1000

function dateForGrouping(row: AdminChargeRow): string {
  return row.invoice_date ?? row.period_end ?? row.created_at
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
  const { selectedHallId, loading: loadingHalls } = useAdminHall()
  const [rows, setRows] = useState<AdminChargeRow[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loadingRows, setLoadingRows] = useState(false)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedHallId) {
        setRows([])
        return
      }

      const client = getSupabaseClient()
      if (!client) {
        setError('Supabase non configure.')
        return
      }

      setLoadingRows(true)
      const allRows: unknown[] = []
      let from = 0
      let rowsError: { message: string } | null = null

      do {
        const { data, error } = await client
          .from('service_charges')
          .select('id, label, category, amount_incl_tax, pennylane_id, invoice_date, created_at, service_charge_periods!inner(period_end)')
          .eq('hall_id', selectedHallId)
          .order('invoice_date', { ascending: false })
          .range(from, from + CHARGES_PAGE_SIZE - 1)

        if (error) {
          rowsError = error
          break
        }

        allRows.push(...(data ?? []))
        if ((data ?? []).length < CHARGES_PAGE_SIZE) {
          break
        }
        from += CHARGES_PAGE_SIZE
      } while (true)

      if (rowsError) {
        setError(rowsError.message)
        setLoadingRows(false)
        return
      }

      const normalized = (allRows as Array<
        Omit<AdminChargeRow, 'period_end'> & {
          service_charge_periods: { period_end: string } | { period_end: string }[] | null
        }
      >).map((row) => {
        const relation = row.service_charge_periods
        const periodEnd = (Array.isArray(relation) ? relation[0]?.period_end : relation?.period_end) ?? row.created_at
        return { ...row, period_end: periodEnd }
      })

      setRows(normalized)
      setError(null)
      setLoadingRows(false)
    }

    void loadRows()
  }, [selectedHallId])

  const years = useMemo(() => groupByYearMonth(rows), [rows])

  useEffect(() => {
    setSelectedYear(years[0]?.year ?? '')
    setSelectedMonth(years[0]?.months[0]?.month ?? '')
  }, [years])

  const selectedYearGroup = useMemo(() => years.find((year) => year.year === selectedYear) ?? null, [years, selectedYear])
  const selectedMonthGroup = useMemo(
    () => selectedYearGroup?.months.find((month) => month.month === selectedMonth) ?? null,
    [selectedYearGroup, selectedMonth],
  )

  const onYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedMonth(years.find((y) => y.year === year)?.months[0]?.month ?? '')
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
      {loadingHalls || loadingRows ? <StateMessage variant="loading" title="Chargement des frais admin..." /> : null}
      {!loadingHalls && !loadingRows && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loadingHalls && !loadingRows && !error && years.length === 0 ? (
        <StateMessage
          variant="empty"
          title="Aucun frais"
          message="Aucun frais synchronise depuis Pennylane pour cette halle. Lancez une synchronisation dans l'onglet Synchronisation."
        />
      ) : null}

      {!loadingHalls && !loadingRows && !error && years.length > 0 ? (
        <div className="space-y-6">
          <Card title="Historique des frais" subtitle="Source unique: Pennylane. Vue en lecture, alimentee par l'onglet Synchronisation.">
            <div className="grid gap-4 sm:grid-cols-2">
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
                    {selectedMonthGroup.charges.map((row) => (
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
