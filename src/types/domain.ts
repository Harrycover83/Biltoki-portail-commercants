export type UserRole = 'merchant' | 'hall_manager' | 'network_manager' | 'hq' | 'super_admin'

export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  job_title: string | null
  merchant_id: string | null
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

export type MerchantYearGroup = {
  year: string
  totalChargesCents: number
  months: MerchantMonthGroup[]
}

type MerchantMonthGroup = {
  month: string // '01'..'12'
  monthLabel: string // 'Janvier 2026'
  totalChargesCents: number
  charges: ChargeLine[]
}
