import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getMerchantHallOptions } from '../services/merchantService'
import { InvoiceCard } from '../../../components/ui/InvoiceCard'
import type { MerchantHallOption } from '../../../types/domain'
import type { Invoice } from '../services/invoiceService'

export function HistoryPage() {
  const [halls, setHalls] = useState<MerchantHallOption[]>([])
  const [selectedHallId, setSelectedHallId] = useState('')
  const [invoicesByMonth, setInvoicesByMonth] = useState<Map<string, Invoice[]>>(
    new Map()
  )
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
      
      // Try to get merchant ID from the first hall option (you may need to adjust this)
      // For now, we'll need to fetch it from the service
      setLoading(false)
    }

    void loadHalls()
  }, [])

  // Get merchant ID and load invoices
  useEffect(() => {
    const loadInvoices = async () => {
      if (!selectedHallId) {
        setInvoicesByMonth(new Map())
        return
      }

      try {
        setLoading(true)
        // Note: You may need to fetch merchant ID first from the service
        // For now, assuming merchant ID is available from auth context or similar
        // This will be improved in the next iteration
        
        // Placeholder - we'll need to get merchantId from context
        // For now, we'll just show a loading state
        setInvoicesByMonth(new Map())
      } catch (err) {
        console.error('Failed to load invoices:', err)
        setError('Impossible de charger les factures')
      } finally {
        setLoading(false)
      }
    }

    void loadInvoices()
  }, [selectedHallId])

  return (
    <PageContainer>
      {loading ? (
        <StateMessage variant="loading" title="Chargement des factures..." />
      ) : null}
      {!loading && error ? (
        <StateMessage variant="error" title="Erreur" message={error} />
      ) : null}
      {!loading && !error && invoicesByMonth.size === 0 ? (
        <StateMessage
          variant="empty"
          title="Aucune facture"
          message="Aucune facture disponible pour le moment."
        />
      ) : null}

      {invoicesByMonth.size > 0 ? (
        <div className="space-y-6">
          {halls.length > 1 ? (
            <Card className="pb-4">
              <label className="mb-1 block text-sm font-medium text-[#4d5562]">
                Halle
              </label>
              <select
                value={selectedHallId}
                onChange={(event) => setSelectedHallId(event.target.value)}
                className="brand-input max-w-sm"
              >
                {halls.map((hall) => (
                  <option key={hall.hallId} value={hall.hallId}>
                    {hall.hallName}
                  </option>
                ))}
              </select>
            </Card>
          ) : null}

          {Array.from(invoicesByMonth.entries()).map(([monthKey, monthInvoices]) => (
            <Card key={monthKey} title={`Factures - ${monthKey}`}>
              <div className="space-y-2">
                {monthInvoices.map((invoice) => (
                  <InvoiceCard key={invoice.id} invoice={invoice} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </PageContainer>
  )
}
