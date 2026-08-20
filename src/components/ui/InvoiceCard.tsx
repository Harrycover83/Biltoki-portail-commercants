import type { Invoice } from '@/features/merchant/services/invoiceService'
import {
  getStatusLabel,
  getStatusBgColor,
  getStatusTextColor,
} from '@/lib/invoiceStatus'
import { formatEuroFromCents } from '@/lib/money'

interface InvoiceCardProps {
  invoice: Invoice
  onPaymentClick?: (invoice: Invoice) => void
}

export function InvoiceCard({ invoice, onPaymentClick }: InvoiceCardProps) {
  const statusLabel = getStatusLabel(invoice.status)
  const bgColor = getStatusBgColor(invoice.status)
  const textColor = getStatusTextColor(invoice.status)
  const amountRemaining = invoice.amount - invoice.amountPaid

  const issuedDate = new Date(invoice.issuedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className={`${bgColor} rounded-lg p-4 mb-3 border-l-4 border-current`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`${textColor} font-semibold`}>Facture</h3>
            <span
              className={`${textColor} text-xs font-medium px-2 py-1 rounded-full ${bgColor}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className={`${textColor} text-sm`}>Émise le {issuedDate}</p>
        </div>
        <div className="text-right">
          <p className={`${textColor} text-lg font-bold`}>
            {formatEuroFromCents(Math.round(invoice.amount * 100))}
          </p>
        </div>
      </div>

      {invoice.amountPaid > 0 && (
        <div className="mb-3 pt-2 border-t border-current border-opacity-20">
          <div className="flex justify-between text-sm mb-2">
            <span className={textColor}>Payé:</span>
            <span className={`${textColor} font-semibold`}>
              {formatEuroFromCents(Math.round(invoice.amountPaid * 100))}
            </span>
          </div>
          {amountRemaining > 0 && (
            <div className="flex justify-between text-sm">
              <span className={textColor}>Reste à payer:</span>
              <span className={`${textColor} font-semibold`}>
                {formatEuroFromCents(Math.round(amountRemaining * 100))}
              </span>
            </div>
          )}
        </div>
      )}

      {invoice.status !== 'paid' && onPaymentClick && (
        <button
          onClick={() => onPaymentClick(invoice)}
          className={`w-full mt-2 px-3 py-2 text-sm font-medium rounded ${textColor} hover:opacity-90 transition-opacity border ${textColor} border-current`}
        >
          Enregistrer un paiement
        </button>
      )}
    </div>
  )
}
