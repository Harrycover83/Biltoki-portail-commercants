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
  hallName: string
  standName: string
  standNumber: string
  periodLabel: string
  totalChargesCents: number
  allocationPercentage: number
  linearMeters: number
  totalLinearMeters: number
}

export type ChargeLine = {
  id: string
  label: string
  category: string | null
  totalCents: number
  allocatedCents: number
}
