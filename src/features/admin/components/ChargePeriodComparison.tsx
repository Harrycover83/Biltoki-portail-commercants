import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { capitalize } from '@/lib/format'
import { formatEuroFromCents } from '@/lib/money'
import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'
import {
  comparePeriods,
  formatPeriodKey,
  listPeriodKeys,
  shiftPeriodKey,
  type Granularity,
  type GroupBy,
  type PeriodComparison,
} from '@/features/admin/charges/chargeComparison'
import { deltaTextClass, formatSignedEuro, formatSignedPercent } from '@/features/admin/charges/chargeFormat'

type ChargePeriodComparisonProps = {
  rows: AdminChargeRow[]
  onSelectSupplier: (supplier: string) => void
}

const PRESET_BUTTON_CLASS =
  'rounded-full border border-[#d6cebf] px-3 py-1 text-xs font-bold text-[#171511] hover:bg-[#f7e7b8]'

/** Keeps a picked period selectable even when it lies outside the range of the invoices. */
function withPeriod(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys : [...keys, key].sort().reverse()
}

function describeComparison(comparison: PeriodComparison, currentLabel: string, referenceLabel: string): string {
  if (comparison.referenceCount === 0) {
    return `Aucune facture en ${referenceLabel} : pas de point de comparaison pour ${currentLabel}.`
  }
  if (comparison.currentCount === 0) {
    return `Aucune facture en ${currentLabel}, contre ${formatEuroFromCents(comparison.referenceCents)} en ${referenceLabel}.`
  }

  const trend =
    comparison.deltaCents === 0
      ? `Les charges de ${currentLabel} sont identiques à celles de ${referenceLabel}.`
      : `Les charges de ${currentLabel} sont ${comparison.deltaCents > 0 ? 'en hausse' : 'en baisse'} de ${formatSignedPercent(
          comparison.deltaPct,
        ).replace(/^[+−]/, '')} (${formatSignedEuro(comparison.deltaCents)}) par rapport à ${referenceLabel}.`

  const driver = comparison.lines[0]
  return driver && driver.deltaCents !== 0
    ? `${trend} Premier contributeur à l'écart : ${driver.name} (${formatSignedEuro(driver.deltaCents)}).`
    : trend
}

export function ChargePeriodComparison({ rows, onSelectSupplier }: ChargePeriodComparisonProps) {
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [groupBy, setGroupBy] = useState<GroupBy>('supplier')
  const [pickedCurrent, setPickedCurrent] = useState('')
  const [pickedReference, setPickedReference] = useState('')

  const availableKeys = useMemo(() => listPeriodKeys(rows, granularity), [rows, granularity])
  const current = pickedCurrent || availableKeys[0] || ''
  const sameLastYear = shiftPeriodKey(current, granularity, granularity === 'month' ? -12 : -1)
  const reference = pickedReference || sameLastYear
  const periodOptions = useMemo(
    () => withPeriod(withPeriod(availableKeys, current), reference),
    [availableKeys, current, reference],
  )

  const comparison = useMemo(
    () => comparePeriods(rows, { granularity, groupBy, current, reference }),
    [rows, granularity, groupBy, current, reference],
  )

  const currentLabel = formatPeriodKey(current)
  const referenceLabel = formatPeriodKey(reference)
  const maxAbsDelta = Math.max(1, ...comparison.lines.map((line) => Math.abs(line.deltaCents)))

  const changeGranularity = (next: Granularity) => {
    setGranularity(next)
    setPickedCurrent('')
    setPickedReference('')
  }

  return (
    <div className="space-y-6">
      <Card
        title="Comparer deux périodes"
        subtitle="Choisissez une période et celle à laquelle la comparer : l'écart est détaillé poste par poste."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="compare-granularity">
              Comparer par
            </label>
            <select
              id="compare-granularity"
              value={granularity}
              onChange={(event) => changeGranularity(event.target.value as Granularity)}
              className="brand-input"
            >
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="compare-current">
              Période
            </label>
            <select
              id="compare-current"
              value={current}
              onChange={(event) => setPickedCurrent(event.target.value)}
              className="brand-input"
            >
              {periodOptions.map((key) => (
                <option key={key} value={key}>
                  {capitalize(formatPeriodKey(key))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="compare-reference">
              Comparée à
            </label>
            <select
              id="compare-reference"
              value={reference}
              onChange={(event) => setPickedReference(event.target.value)}
              className="brand-input"
            >
              {periodOptions.map((key) => (
                <option key={key} value={key}>
                  {capitalize(formatPeriodKey(key))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4d5562]" htmlFor="compare-group">
              Détail par
            </label>
            <select
              id="compare-group"
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as GroupBy)}
              className="brand-input"
            >
              <option value="supplier">Fournisseur</option>
              <option value="category">Catégorie</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={PRESET_BUTTON_CLASS} onClick={() => setPickedReference(sameLastYear)}>
            {granularity === 'month' ? 'Même mois l’an dernier' : 'Année précédente'}
          </button>
          {granularity === 'month' ? (
            <button
              type="button"
              className={PRESET_BUTTON_CLASS}
              onClick={() => setPickedReference(shiftPeriodKey(current, 'month', -1))}
            >
              Mois précédent
            </button>
          ) : null}
        </div>
      </Card>

      <Card title={`${capitalize(currentLabel)} comparé à ${currentLabel === referenceLabel ? 'lui-même' : referenceLabel}`}>
        <p className="text-sm text-[#4d5562]">{describeComparison(comparison, currentLabel, referenceLabel)}</p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">{capitalize(currentLabel)}</dt>
            <dd className="mt-1 text-xl font-semibold text-[#13223a]">{formatEuroFromCents(comparison.currentCents)}</dd>
            <dd className="text-xs text-[#626a78]">{comparison.currentCount} facture(s)</dd>
          </div>
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">{capitalize(referenceLabel)}</dt>
            <dd className="mt-1 text-xl font-semibold text-[#13223a]">{formatEuroFromCents(comparison.referenceCents)}</dd>
            <dd className="text-xs text-[#626a78]">{comparison.referenceCount} facture(s)</dd>
          </div>
          <div className="rounded-md border border-[#e1dacd] p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.06em] text-[#626a78]">Écart</dt>
            <dd className={`mt-1 text-xl font-semibold ${deltaTextClass(comparison.deltaCents)}`}>
              {formatSignedEuro(comparison.deltaCents)}
            </dd>
            <dd className={`text-xs ${deltaTextClass(comparison.deltaCents)}`}>{formatSignedPercent(comparison.deltaPct)}</dd>
          </div>
        </dl>

        {comparison.lines.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#13223a1f] text-[#626a78]">
                  <th className="py-2">{groupBy === 'supplier' ? 'Fournisseur' : 'Catégorie'}</th>
                  <th className="py-2 text-right">{capitalize(currentLabel)}</th>
                  <th className="py-2 text-right">{capitalize(referenceLabel)}</th>
                  <th className="py-2 text-right">Écart</th>
                  <th className="py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {comparison.lines.map((line) => (
                  <tr key={line.name} className="border-b border-slate-100/80">
                    <td className="py-3">
                      {groupBy === 'supplier' ? (
                        <button
                          type="button"
                          className="text-left font-semibold text-[#13223a] underline decoration-dotted underline-offset-2 hover:text-[#d84d2c]"
                          title="Voir l'historique de ce fournisseur"
                          onClick={() => onSelectSupplier(line.name)}
                        >
                          {line.name}
                        </button>
                      ) : (
                        line.name
                      )}
                      {line.referenceCents === 0 && line.currentCents !== 0 ? (
                        <span className="ml-2 rounded-full bg-[#f7e7b8] px-2 py-0.5 text-[11px] font-bold">Nouveau</span>
                      ) : null}
                      {line.currentCents === 0 && line.referenceCents !== 0 ? (
                        <span className="ml-2 rounded-full bg-[#e8e3d8] px-2 py-0.5 text-[11px] font-bold">Absent</span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">{formatEuroFromCents(line.currentCents)}</td>
                    <td className="py-3 text-right whitespace-nowrap">{formatEuroFromCents(line.referenceCents)}</td>
                    <td className={`py-3 text-right whitespace-nowrap font-semibold ${deltaTextClass(line.deltaCents)}`}>
                      {formatSignedEuro(line.deltaCents)}
                      <div
                        aria-hidden="true"
                        className={`ml-auto mt-1 h-1 rounded-full ${line.deltaCents > 0 ? 'bg-[#b3361b]' : 'bg-[#2b7a4b]'}`}
                        style={{ width: `${Math.round((Math.abs(line.deltaCents) / maxAbsDelta) * 100)}%` }}
                      />
                    </td>
                    <td className={`py-3 text-right whitespace-nowrap ${deltaTextClass(line.deltaCents)}`}>
                      {formatSignedPercent(line.deltaPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-[#13223a]">
                  <td className="pt-3">Total</td>
                  <td className="pt-3 text-right whitespace-nowrap">{formatEuroFromCents(comparison.currentCents)}</td>
                  <td className="pt-3 text-right whitespace-nowrap">{formatEuroFromCents(comparison.referenceCents)}</td>
                  <td className={`pt-3 text-right whitespace-nowrap ${deltaTextClass(comparison.deltaCents)}`}>
                    {formatSignedEuro(comparison.deltaCents)}
                  </td>
                  <td className={`pt-3 text-right whitespace-nowrap ${deltaTextClass(comparison.deltaCents)}`}>
                    {formatSignedPercent(comparison.deltaPct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
