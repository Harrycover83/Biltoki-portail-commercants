import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { formatEuroFromCents } from '@/lib/money'
import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import { ChargeDocumentButton } from '@/features/admin/components/ChargeDocumentButton'
import { buildSupplierHistory, chargeCents, listSuppliers } from '@/features/admin/charges/chargeComparison'

type SupplierHistoryPanelProps = {
  rows: AdminChargeRow[]
  /** Supplier to show; falls back to the biggest one. */
  supplier: string | null
  onSelectSupplier: (supplier: string) => void
  onError: (message: string | null) => void
}

export function SupplierHistoryPanel({ rows, supplier, onSelectSupplier, onError }: SupplierHistoryPanelProps) {
  const suppliers = useMemo(() => listSuppliers(rows), [rows])
  const selected = suppliers.find((entry) => entry.name === supplier)?.name ?? suppliers[0]?.name ?? ''
  const history = useMemo(() => buildSupplierHistory(rows, selected), [rows, selected])

  if (suppliers.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <Card title="Historique d'un fournisseur" subtitle="Choisissez un fournisseur pour retrouver toutes ses factures, toutes années confondues.">
        <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="supplier-select">
          Fournisseur
        </label>
        <select
          id="supplier-select"
          value={selected}
          onChange={(event) => onSelectSupplier(event.target.value)}
          className="brand-input sm:max-w-md"
        >
          {suppliers.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name} ({formatEuroFromCents(entry.totalCents)})
            </option>
          ))}
        </select>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">Total facturé</dt>
            <dd className="mt-1 text-xl font-semibold text-[#13223a]">{formatEuroFromCents(history.totalCents)}</dd>
          </div>
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">Factures</dt>
            <dd className="mt-1 text-xl font-semibold text-[#13223a]">{history.count}</dd>
          </div>
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">Moyenne par facture</dt>
            <dd className="mt-1 text-xl font-semibold text-[#13223a]">{formatEuroFromCents(history.averageCents)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Toutes les factures" subtitle={`${history.count} facture(s), de la plus récente à la plus ancienne`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#13223a1f] text-[#626a78]">
                <th className="py-2">Date</th>
                <th className="py-2">Poste</th>
                <th className="py-2">Catégorie</th>
                <th className="py-2 text-right">Montant TTC</th>
                <th className="py-2 text-right">Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {history.invoices.map((row) => (
                <tr key={row.id} className="border-b border-slate-100/80 last:border-b-0">
                  <td className="py-3 whitespace-nowrap text-[#626a78]">
                    {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="py-3">{row.label}</td>
                  <td className="py-3">{row.category ?? '-'}</td>
                  <td className="py-3 text-right font-semibold text-[#13223a]">
                    {formatEuroFromCents(chargeCents(row))}
                  </td>
                  <td className="py-3 text-right">
                    {row.pennylane_id ? <ChargeDocumentButton chargeId={row.id} onError={onError} /> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
