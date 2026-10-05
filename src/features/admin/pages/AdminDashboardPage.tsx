import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clsx } from 'clsx'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card } from '@/components/ui/Card'
import {
  mockAlerts,
  mockDailyRevenue,
  mockFinance,
  mockHr,
  mockKpis,
  mockStock,
  mockTasks,
  type DashboardAlert,
} from '@/features/admin/dashboard/mockDashboardData'

const alertStyles: Record<DashboardAlert['level'], string> = {
  high: 'border-l-4 border-[#d84d2c] bg-[#fdeee9]',
  medium: 'border-l-4 border-[#d18b21] bg-[#fdf3dc]',
  info: 'border-l-4 border-[#2468a8] bg-[#e8f0f8]',
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#e4ddd1] py-2 last:border-b-0">
      <dt className="text-sm text-[#615b51]">{label}</dt>
      <dd className="text-sm font-bold text-[#171511]">{value}</dd>
    </div>
  )
}

export function AdminDashboardPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="border border-dashed border-[#d18b21] bg-[#fdf3dc] px-4 py-3 text-sm font-semibold text-[#171511]">
          Aperçu : données fictives pour visualiser le futur tableau de bord. Les sources (Popina, Skello,
          Pennylane, Notion) seront branchées progressivement.
        </div>

        <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockKpis.map((kpi) => (
            <Card key={kpi.label}>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#615b51]">{kpi.label}</p>
              <p className="brand-display mt-2 text-3xl font-semibold text-[#171511]">{kpi.value}</p>
              <p className={clsx('mt-1 text-sm font-semibold', kpi.trendPositive ? 'text-[#348b57]' : 'text-[#d84d2c]')}>
                {kpi.trend}
              </p>
              <p className="mt-2 text-xs text-[#8a8377]">Source : {kpi.source}</p>
            </Card>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="CA de la semaine" subtitle="Par jour, comparé à la semaine précédente.">
            <div className="h-[280px] w-full" aria-label="CA par jour de la semaine">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockDailyRevenue} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e4ddd1" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: '#626a78', fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: '#626a78', fontSize: 12 }}
                    tickFormatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`}
                    width={78}
                  />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} €`} />
                  <Legend />
                  <Bar dataKey="lastWeek" name="Semaine précédente" fill="#d6cebf" />
                  <Bar dataKey="revenue" name="Cette semaine" fill="#348b57" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="À traiter" subtitle="Alertes de toutes les sources.">
            <ul className="space-y-2">
              {mockAlerts.map((alert) => (
                <li key={alert.title} className={clsx('px-3 py-2', alertStyles[alert.level])}>
                  <p className="text-sm font-bold text-[#171511]">{alert.title}</p>
                  <p className="text-xs text-[#4a5261]">
                    {alert.detail} · {alert.source}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card title="RH" subtitle="Skello">
            <dl>
              <Stat label="Heures prévues" value={`${mockHr.hoursPlanned} h`} />
              <Stat label="Heures travaillées" value={`${mockHr.hoursWorked} h`} />
              <Stat label="Absents aujourd’hui" value={mockHr.employeesOnLeaveToday} />
            </dl>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-[#615b51]">Solde de CP</p>
            <dl>
              {mockHr.leaveBalances.map((entry) => (
                <Stat key={entry.name} label={entry.name} value={`${entry.days} j`} />
              ))}
            </dl>
          </Card>

          <Card title="Finances" subtitle="Pennylane">
            <dl>
              <Stat label="Achats du mois" value={mockFinance.purchasesMonth} />
              <Stat label="Achats / CA" value={mockFinance.purchasesRatio} />
              <Stat label="Factures à payer" value={mockFinance.unpaidInvoices} />
              <Stat label="Trésorerie" value={mockFinance.cashBalance} />
            </dl>
          </Card>

          <Card title="Stock" subtitle="Inventaire + ventes Popina">
            <dl>
              <Stat label="Articles sous le seuil" value={mockStock.itemsBelowThreshold} />
              <Stat label="Commandes à valider" value={mockStock.ordersToValidate} />
              <Stat label="Écart d’inventaire" value={mockStock.inventoryGap} />
              <Stat label="Valeur du stock" value={mockStock.stockValue} />
            </dl>
          </Card>

          <Card title="Organisation" subtitle="Notion">
            <ul className="space-y-2">
              {mockTasks.map((task) => (
                <li key={task.title} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-[#171511]">{task.title}</span>
                  <span className={clsx('shrink-0 font-bold', task.late ? 'text-[#d84d2c]' : 'text-[#615b51]')}>
                    {task.late ? 'En retard · ' : ''}
                    {task.due}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
