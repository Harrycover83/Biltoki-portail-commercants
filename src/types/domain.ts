export type UserRole = 'merchant' | 'admin'

export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  merchant_id: string | null
}

export type MerchantDashboardSummary = {
  merchantName: string
  hallId: string
  hallName: string
  periodLabel: string
  totalChargesCents: number
  lineCount: number
}

export type MerchantHallOption = {
  hallId: string
  hallName: string
}

export type ChargeLine = {
  id: string
  label: string
  category: string | null
  totalCents: number
}

export type MerchantHistoryRow = {
  periodId: string
  periodLabel: string
  totalChargesCents: number
  periodEnd: string
}

export type MerchantChargePeriodDetail = {
  periodId: string
  periodLabel: string
  totalChargesCents: number
  lines: ChargeLine[]
}
