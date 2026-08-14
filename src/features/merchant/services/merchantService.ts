import type { ChargeLine, MerchantDashboardSummary } from '../../../types/domain'
import { sampleCharges, sampleSummary } from '../mockData'

export async function getMerchantDashboardSummary(): Promise<MerchantDashboardSummary> {
  return sampleSummary
}

export async function getMerchantChargeLines(): Promise<ChargeLine[]> {
  return sampleCharges
}
