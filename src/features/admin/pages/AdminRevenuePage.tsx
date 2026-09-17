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

const palette = ['#d84d2c', '#348b57', '#2468a8', '#9b5de5', '#d18b21', '#ef476f', '#06d6a0', '#118ab2']

type MonthlyRevenueEntry = {
  month: string
  amount: number
}

type MerchantRevenueRow = {
  merchant: string
  revenue: MonthlyRevenueEntry[]
}

const defaultData: MerchantRevenueRow[] = [
  {
    merchant: 'Chez elles',
    revenue: [
      { month: '2026-01', amount: 12000 },
      { month: '2026-02', amount: 12600 },
      { month: '2026-03', amount: 13150 },
      { month: '2026-04', amount: 13850 },
      { month: '2026-05', amount: 14600 },
      { month: '2026-06', amount: 15120 },
      { month: '2026-07', amount: 15382.03 },
      { month: '2026-08', amount: 15382.03 },
    ],
  },
  {
    merchant: 'Falafels',
    revenue: [
      { month: '2026-01', amount: 23000 },
      { month: '2026-02', amount: 24050 },
      { month: '2026-03', amount: 25180 },
      { month: '2026-04', amount: 26320 },
      { month: '2026-05', amount: 27140 },
      { month: '2026-06', amount: 27900 },
      { month: '2026-07', amount: 28193.45 },
      { month: '2026-08', amount: 28193.45 },
    ],
  },
  {
    merchant: 'Le Canon',
    revenue: [
      { month: '2026-01', amount: 28000 },
      { month: '2026-02', amount: 29400 },
      { month: '2026-03', amount: 30750 },
      { month: '2026-04', amount: 31890 },
      { month: '2026-05', amount: 32520 },
      { month: '2026-06', amount: 33380 },
      { month: '2026-07', amount: 34345.97 },
      { month: '2026-08', amount: 34345.97 },
    ],
  },
  {
    merchant: 'Café Biltoki',
    revenue: [
      { month: '2026-01', amount: 86000 },
      { month: '2026-02', amount: 90000 },
      { month: '2026-03', amount: 93000 },
      { month: '2026-04', amount: 95250 },
      { month: '2026-05', amount: 96800 },
      { month: '2026-06', amount: 97850 },
      { month: '2026-07', amount: 98944.99 },
      { month: '2026-08', amount: 98944.99 },
    ],
  },
  {
    merchant: 'All Angus',
    revenue: [
      { month: '2026-01', amount: 33000 },
      { month: '2026-02', amount: 34250 },
      { month: '2026-03', amount: 35580 },
      { month: '2026-04', amount: 36900 },
      { month: '2026-05', amount: 38250 },
      { month: '2026-06', amount: 39580 },
      { month: '2026-07', amount: 40765.56 },
      { month: '2026-08', amount: 40765.56 },
    ],
  },
  {
    merchant: 'Balme',
    revenue: [
      { month: '2026-01', amount: 9000 },
      { month: '2026-02', amount: 9500 },
      { month: '2026-03', amount: 10120 },
      { month: '2026-04', amount: 10850 },
      { month: '2026-05', amount: 11120 },
      { month: '2026-06', amount: 11320 },
      { month: '2026-07', amount: 11478.31 },
      { month: '2026-08', amount: 11478.31 },
    ],
  },
  {
    merchant: 'La Casa Corsa',
    revenue: [
      { month: '2026-01', amount: 26000 },
      { month: '2026-02', amount: 27150 },
      { month: '2026-03', amount: 28200 },
      { month: '2026-04', amount: 29140 },
      { month: '2026-05', amount: 29680 },
      { month: '2026-06', amount: 29920 },
      { month: '2026-07', amount: 30135.79 },
      { month: '2026-08', amount: 30135.79 },
    ],
  },
  {
    merchant: 'La Casa Pincho',
    revenue: [
      { month: '2026-01', amount: 25000 },
      { month: '2026-02', amount: 26050 },
      { month: '2026-03', amount: 27180 },
      { month: '2026-04', amount: 28090 },
      { month: '2026-05', amount: 28760 },
      { month: '2026-06', amount: 29150 },
      { month: '2026-07', amount: 29624.99 },
      { month: '2026-08', amount: 29624.99 },
    ],
  },
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

export function AdminRevenuePage() {
  const [data, setData] = useState<MerchantRevenueRow[]>(defaultData)

  const chartData = useMemo(() => {
    const allMonths = Array.from(
      new Set(data.flatMap((merchant) => merchant.revenue.map((point) => point.month))),
    ).sort()

    return allMonths.map((month) => {
      const row: Record<string, string | number> = { month: formatMonthKey(month) }
      for (const merchant of data) {
        const point = merchant.revenue.find((entry) => entry.month === month)
        row[merchant.merchant] = point?.amount ?? 0
      }
      return row
    })
  }, [data])

  const updateMerchantAmount = (merchantName: string, month: string, value: number) => {
    setData((current) =>
      current.map((merchant) =>
        merchant.merchant === merchantName
          ? {
              ...merchant,
              revenue: merchant.revenue.map((entry) =>
                entry.month === month ? { ...entry, amount: Number.isFinite(value) ? value : 0 } : entry,
              ),
            }
          : merchant,
      ),
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <Card title="Chiffre d’affaires global des stands" subtitle="Évolution mensuelle par commerçant, avec une courbe par stand et une couleur distincte.">
          <div className="h-[360px] w-full" aria-label="Courbes d'évolution du chiffre d'affaires des stands">
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
                {data.map((merchant, index) => (
                  <Line
                    key={merchant.merchant}
                    type="monotone"
                    dataKey={merchant.merchant}
                    name={merchant.merchant}
                    stroke={palette[index % palette.length]}
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#fffcf6', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Données CA par stand" subtitle="Modifier les montants mensuels pour ajuster les courbes en temps réel.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#13223a1f] text-[#626a78]">
                  <th className="py-2">Stand</th>
                  {defaultData[0].revenue.map((entry) => (
                    <th key={entry.month} className="py-2 text-right">
                      {formatMonthKey(entry.month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((merchant, merchantIndex) => (
                  <tr key={merchant.merchant} className="border-b border-slate-100/80 last:border-b-0">
                    <td className="py-3 font-semibold text-[#171511]">{merchant.merchant}</td>
                    {merchant.revenue.map((entry) => (
                      <td key={`${merchant.merchant}-${entry.month}`} className="py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={entry.amount}
                          onChange={(event) =>
                            updateMerchantAmount(merchant.merchant, entry.month, Number(event.target.value || 0))
                          }
                          className="brand-input w-24 text-right"
                          aria-label={`CA ${merchant.merchant} ${formatMonthKey(entry.month)}`}
                          style={{ borderColor: palette[merchantIndex % palette.length] }}
                        />
                      </td>
                    ))}
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
