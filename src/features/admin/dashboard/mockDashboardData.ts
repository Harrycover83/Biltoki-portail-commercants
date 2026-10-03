// APERCU UNIQUEMENT : donnees fictives en dur pour visualiser le futur dashboard.
// A supprimer (avec AdminDashboardPage.tsx) lors du branchement des vraies sources
// (Popina/Jalia, Skello, Pennylane, Notion).

export type DashboardKpi = {
  label: string
  value: string
  trend: string
  trendPositive: boolean
  source: string
}

export type DashboardAlert = {
  level: 'high' | 'medium' | 'info'
  title: string
  detail: string
  source: string
}

export const mockKpis: DashboardKpi[] = [
  { label: 'CA du mois', value: '84 250 €', trend: '+6,2 % vs mois dernier', trendPositive: true, source: 'Popina' },
  { label: 'Productivité', value: '47 €/h', trend: '+2 €/h vs semaine dernière', trendPositive: true, source: 'Popina + Skello' },
  { label: 'Masse salariale / CA', value: '31,4 %', trend: '+0,8 pt vs mois dernier', trendPositive: false, source: 'Skello + Popina' },
  { label: 'Ticket moyen', value: '18,60 €', trend: '+0,40 € vs mois dernier', trendPositive: true, source: 'Popina' },
]

export const mockDailyRevenue = [
  { day: 'Lun', revenue: 2100, lastWeek: 1950 },
  { day: 'Mar', revenue: 2350, lastWeek: 2200 },
  { day: 'Mer', revenue: 2600, lastWeek: 2500 },
  { day: 'Jeu', revenue: 3100, lastWeek: 2900 },
  { day: 'Ven', revenue: 4800, lastWeek: 4500 },
  { day: 'Sam', revenue: 5900, lastWeek: 6100 },
  { day: 'Dim', revenue: 3400, lastWeek: 3200 },
]

export const mockAlerts: DashboardAlert[] = [
  { level: 'high', title: 'Fût IPA 30 L : rupture prévue dans 2 jours', detail: 'Stock théorique 18 L, ventes moyennes 9 L/jour', source: 'Stock' },
  { level: 'high', title: '3 factures fournisseurs en retard', detail: 'Total 2 340 € TTC', source: 'Pennylane' },
  { level: 'medium', title: 'Fin de période d’essai : Camille D.', detail: 'Dans 12 jours (15/10/2026)', source: 'Skello' },
  { level: 'medium', title: 'Commande à valider : Brasserie du Port', detail: '6 fûts, 4 caisses de softs', source: 'Stock' },
  { level: 'info', title: 'Charges communes de septembre à répartir', detail: '14 factures importées', source: 'Halles' },
]

export const mockHr = {
  hoursPlanned: 612,
  hoursWorked: 598,
  employeesOnLeaveToday: 2,
  leaveBalances: [
    { name: 'Camille D.', days: 4.5 },
    { name: 'Lucas M.', days: 12 },
    { name: 'Sarah B.', days: 18.5 },
  ],
}

export const mockFinance = {
  purchasesMonth: '21 480 €',
  purchasesRatio: '25,5 %',
  unpaidInvoices: '6 120 €',
  cashBalance: '38 900 €',
}

export const mockStock = {
  itemsBelowThreshold: 4,
  ordersToValidate: 2,
  inventoryGap: '-1,8 %',
  stockValue: '9 750 €',
}

export const mockTasks = [
  { title: 'Renouveler l’assurance de la halle', due: '10/10', late: false },
  { title: 'Réunion des commerçants', due: '07/10', late: false },
  { title: 'Contrôle sanitaire : relever les températures', due: '01/10', late: true },
]
