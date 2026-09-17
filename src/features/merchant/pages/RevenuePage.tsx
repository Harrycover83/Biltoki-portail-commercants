import { useMemo, useState } from 'react'
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
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { useAuth } from '../../auth/AuthProvider'

type MonthlyRevenueEntry = {
  month: string
  amount: number
}

const defaultEntries: MonthlyRevenueEntry[] = [
  { month: '2026-01', amount: 12000 },
  { month: '2026-02', amount: 12600 },
  { month: '2026-03', amount: 13150 },
  { month: '2026-04', amount: 13850 },
  { month: '2026-05', amount: 14600 },
  { month: '2026-06', amount: 15120 },
  { month: '2026-07', amount: 15382.03 },
  { month: '2026-08', amount: 15382.03 },
]

function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-')
  const date = new Date(Number(year), Number(monthNumber) - 1, 1)
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(date)
}

export function RevenuePage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<MonthlyRevenueEntry[]>(defaultEntries)

  const chartData = useMemo(
    () => entries.map((entry) => ({
      month: formatMonthKey(entry.month),
      amount: entry.amount,
    })),
    [entries],
  )

  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  const lastAmount = entries.at(-1)?.amount ?? 0
  const previousAmount = entries.at(-2)?.amount ?? lastAmount
  const monthDelta = lastAmount - previousAmount

  const setAmountForMonth = (month: string, value: number) => {
    setEntries((current) =>
      current.map((entry) => (entry.month === month ? { ...entry, amount: Number.isFinite(value) ? value : 0 } : entry)),
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card
          title="Déclaration du CA mensuel"
          subtitle={profile ? `Stand de ${profile.first_name ?? 'Commerçant'}` : 'Suivi de chiffre d’affaires'}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Total déclaré" value={formatEuro(total)} />
            <Metric label="Dernier mois" value={formatEuro(lastAmount)} />
            <Metric label="Évolution" value={`${monthDelta >= 0 ? '+' : ''}${formatEuro(monthDelta)}`} />
          </div>

          <div className="mt-6 h-[320px] w-full" aria-label="Courbe d'évolution du chiffre d'affaires mensuel">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#626a78', fontSize: 12 }} minTickGap={18} />
                <YAxis
                  tick={{ fill: '#626a78', fontSize: 12 }}
                  tickFormatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                  width={82}
                />
                <Tooltip
                  formatter={(value) => [formatEuro(Number(value)), 'CA mensuel']}
                  labelStyle={{ color: '#171511' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="CA"
                  stroke="#348b57"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Mes montants mensuels" subtitle="Saisissez ou ajustez les valeurs de CA en fonction des périodes déclarées.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#13223a1f] text-[#626a78]">
                  <th className="py-2">Mois</th>
                  <th className="py-2 text-right">CA</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.month} className="border-b border-slate-100/80 last:border-b-0">
                    <td className="py-3 text-[#171511]">{formatMonthKey(entry.month)}</td>
                    <td className="py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={entry.amount}
                        onChange={(event) => setAmountForMonth(entry.month, Number(event.target.value || 0))}
                        className="brand-input w-36 text-right"
                        aria-label={`CA pour ${formatMonthKey(entry.month)}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-4 border-[#348b57] bg-[#fffcf6] px-5 py-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[#626a78]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#13223a]">{value}</p>
    </div>
  )
}
