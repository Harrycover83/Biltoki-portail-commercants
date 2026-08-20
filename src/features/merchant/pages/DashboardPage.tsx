import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { formatEuroFromCents } from '../../../lib/money'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantDashboardSummary, getMerchantHallOptions } from '../services/merchantService'
import { getCurrentMonthInvoices } from '../services/invoiceService'
import { InvoiceCard } from '../../../components/ui/InvoiceCard'
import type { MerchantDashboardSummary, MerchantHallOption } from '../../../types/domain'
import type { Invoice } from '../services/invoiceService'

export function DashboardPage() {
  const [summary, setSummary] = useState<MerchantDashboardSummary | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoicesLoading, setInvoicesLoading] = useState(false)

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
    }

    void loadHalls()
  }, [])

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedHallId) {
        setSummary(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const result = await getMerchantDashboardSummary(selectedHallId)
      setSummary(result.data)
      setError(result.error)
      setLoading(false)
    }

    void loadSummary()
  }, [selectedHallId])

  // Load invoices for current month
  useEffect(() => {
    const loadInvoices = async () => {
      if (!summary?.merchantId) return

      setInvoicesLoading(true)
      try {
        const currentMonthInvoices = await getCurrentMonthInvoices(
          summary.merchantId
        )
        setInvoices(currentMonthInvoices)
      } catch (err) {
        console.error('Failed to load invoices:', err)
      } finally {
        setInvoicesLoading(false)
      }
    }

    void loadInvoices()
  }, [summary?.merchantId])

  return (
    <PageContainer>
      {loading ? <StateMessage variant="loading" title="Chargement du dashboard..." /> : null}
      {!loading && error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
      {!loading && !error && !summary ? (
        <StateMessage
          variant="empty"
          title="Aucune donnee disponible"
          message="Ajoutez des frais communs dans Pennylane pour afficher votre dashboard."
        />
      ) : null}

      {summary ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
              <div>
                <p className="brand-section-title">Bienvenue</p>
                <h1 className="brand-display mt-3 text-[2.55rem] leading-[0.95] font-semibold">{summary.merchantName}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4d5562]">
                  Un espace de transparence pour suivre les frais communs de votre halle, classes par periode.
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[#13223a17] bg-white/70 p-4">
                <div className="grid gap-3 text-sm text-slate-700">
                  {halls.length > 1 ? (
                    <label className="block">
                      <span className="mb-1 block text-sm text-slate-700">Halle</span>
                      <select
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
                    </label>
                  ) : (
                    <p>
                      Halle : <span className="font-semibold text-[#13223a]">{summary.hallName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Frais de service">
              <p className="text-3xl font-semibold text-[#13223a]">{formatEuroFromCents(summary.totalChargesCents)}</p>
            </Card>
            <Card title="Periode">
              <p className="text-lg font-semibold text-[#13223a]">{summary.periodLabel}</p>
            </Card>
            <Card title="Nombre de postes">
              <p className="text-lg font-semibold text-[#13223a]">{summary.lineCount}</p>
            </Card>
          </div>

          {/* Current month invoices section */}
          <Card title="Factures du mois courant">
            {invoicesLoading ? (
              <StateMessage variant="loading" title="Chargement des factures..." />
            ) : invoices.length === 0 ? (
              <StateMessage
                variant="empty"
                title="Aucune facture"
                message="Aucune facture pour ce mois"
              />
            ) : (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </PageContainer>
  )
}
