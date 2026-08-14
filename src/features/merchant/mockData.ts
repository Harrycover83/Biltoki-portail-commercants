import type { ChargeLine, MerchantDashboardSummary } from '../../types/domain'

export const sampleSummary: MerchantDashboardSummary = {
  merchantName: 'Jean Dupont',
  hallName: 'Les Halles de Biltoki Toulon',
  standName: 'Poissonnerie du Port',
  standNumber: 'A12',
  periodLabel: 'Juillet 2026',
  totalChargesCents: 124560,
  allocationPercentage: 0.125,
  linearMeters: 8,
  totalLinearMeters: 64,
}

export const sampleCharges: ChargeLine[] = [
  {
    id: '1',
    label: 'Nettoyage',
    category: 'operation',
    totalCents: 400000,
    allocatedCents: 50000,
  },
  {
    id: '2',
    label: 'Securite',
    category: 'operation',
    totalCents: 200000,
    allocatedCents: 25000,
  },
  {
    id: '3',
    label: 'Maintenance',
    category: 'operation',
    totalCents: 350000,
    allocatedCents: 43750,
  },
]
