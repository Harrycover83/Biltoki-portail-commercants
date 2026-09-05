export type UserRole = 'merchant' | 'admin'

export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  merchant_id: string | null
}

export type PortalAccessEntry = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  merchant_id: string | null
  hall_id: string | null
  active: boolean
  provisioned_at: string | null
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
  invoiceDate: string | null
}

export type MerchantHistoryRow = {
  periodId: string
  periodLabel: string
  totalChargesCents: number
  periodEnd: string
}

export type MerchantYearGroup = {
  year: string
  totalChargesCents: number
  months: MerchantMonthGroup[]
}

export type MerchantMonthGroup = {
  month: string // '01'..'12'
  monthLabel: string // 'Janvier 2026'
  totalChargesCents: number
  charges: ChargeLine[]
}

export type MerchantChargePeriodDetail = {
  periodId: string
  periodLabel: string
  totalChargesCents: number
  lines: ChargeLine[]
}
