import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import { useAdminHall } from '@/features/admin/AdminHallContext'
import { buildStandRevenue, type Declaration, type StandMerchant } from '@/features/admin/revenue/standRevenue'
import { getHallDeclaredRevenue } from '@/features/admin/services/adminRevenueService'
import { formatDateTime, formatMonthKey } from '@/lib/format'
import { formatEuroFromCents } from '@/lib/money'

const palette = ['#d84d2c', '#348b57', '#2468a8', '#9b5de5', '#d18b21', '#ef476f', '#06d6a0', '#118ab2']

type Loaded = { key: string; merchants?: StandMerchant[]; declarations?: Declaration[]; error?: string }

function trendLabel(percent: number | null): string {
  if (percent === null) return '—'
  return `${percent > 0 ? '+' : ''}${percent.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}

export function AdminRevenuePage() {
  const { halls, selectedHallId, loading } = useAdminHall()
  const hall = halls.find((option) => option.id === selectedHallId)
  const [result, setResult] = useState<Loaded | null>(null)
  const key = hall?.id ?? ''

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void getHallDeclaredRevenue(key).then(({ data, error }) => {
      if (cancelled) return
      setResult(error || !data
        ? { key, error: error ?? 'Impossible de charger le CA des stands.' }
        : { key, merchants: data.merchants, declarations: data.declarations })
    })
    return () => { cancelled = true }
  }, [key])

  // Figures of a previous hall never linger while the next ones load.
  const loaded = result?.key === key ? result : null
  const revenue = useMemo(
    () => (loaded?.merchants && loaded.declarations ? buildStandRevenue(loaded.merchants, loaded.declarations, formatMonthKey) : null),
    [loaded],
  )

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card
          title={`CA des stands${hall ? ` · ${hall.name}` : ''}`}
          subtitle="Dernier chiffre d’affaires mensuel saisi par chaque commerçant. Un stand sans saisie n’affiche aucun montant."
        >
          {loading ? <p role="status">Chargement des halles…</p>
            : !hall ? <p role="alert">Aucune halle accessible sélectionnée.</p>
            : !loaded ? <p role="status">Chargement du CA des stands…</p>
            : loaded.error || !revenue ? <p role="alert" className="border border-[#d84d2c] bg-[#fdeee9] p-3">{loaded.error}</p>
            : revenue.rows.length === 0 ? <p role="status">Aucun commerçant dans cette halle.</p>
            : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#13223a1f] text-[#626a78]">
                      <th className="py-2">Commerçant</th>
                      <th className="py-2">Stand</th>
                      <th className="py-2">Dernier mois saisi</th>
                      <th className="py-2 text-right">CA</th>
                      <th className="py-2 text-right">Évolution</th>
                      <th className="py-2 text-right">Saisi le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.rows.map((row) => (
                      <tr key={row.merchantId} className="border-b border-slate-100/80 last:border-b-0">
                        <td className="py-3 font-semibold text-[#171511]">{row.name}</td>
                        <td className="py-3">{row.stands || '—'}</td>
                        {row.lastMonth && row.lastCents !== null ? (
                          <>
                            <td className="py-3">{formatMonthKey(row.lastMonth)}</td>
                            <td className="py-3 text-right">{formatEuroFromCents(row.lastCents)}</td>
                            <td className="py-3 text-right">{trendLabel(row.trendPercent)}</td>
                            <td className="py-3 text-right text-[#615b51]">{formatDateTime(row.declaredAt)}</td>
                          </>
                        ) : (
                          <td colSpan={4} className="py-3 text-right text-[#615b51]">Aucun CA saisi</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        {revenue && revenue.chart.names.length > 0 && (
          <Card title="Évolution du CA par stand" subtitle="Une courbe par stand, sur tous les mois saisis.">
            <div className="h-[360px] w-full" aria-label="Courbes d'évolution du chiffre d'affaires des stands">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue.chart.months} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: '#626a78', fontSize: 12 }} minTickGap={18} />
                  <YAxis
                    tick={{ fill: '#626a78', fontSize: 12 }}
                    tickFormatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                    width={82}
                  />
                  <Tooltip
                    formatter={(value) => [formatEuroFromCents(Math.round(Number(value) * 100)), 'CA mensuel']}
                    labelStyle={{ color: '#171511' }}
                  />
                  <Legend />
                  {revenue.chart.names.map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stroke={palette[index % palette.length]}
                      strokeWidth={3}
                      connectNulls
                      dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  )
}
