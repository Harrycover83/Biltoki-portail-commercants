import type { ChargeLine, MerchantDashboardSummary } from '../../types/domain'

export const sampleSummary: MerchantDashboardSummary = {
  merchantName: 'Jean Dupont',
  hallName: 'Les Halles de Biltoki Toulon',
  periodLabel: 'Juillet 2026',
  totalChargesCents: 124560,
  lineCount: 3,
}

export const sampleCharges: ChargeLine[] = [
  {
    id: '1',
    label: 'Nettoyage',
    category: 'operation',
    totalCents: 400000,
  },
  {
    id: '2',
    label: 'Securite',
    category: 'operation',
    totalCents: 200000,
  },
  {
    id: '3',
    label: 'Maintenance',
    category: 'operation',
    totalCents: 350000,
  },
]
