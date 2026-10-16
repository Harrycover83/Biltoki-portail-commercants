export type StandMerchant = {
  id: string
  legal_name: string
  trade_name: string | null
  active: boolean
  stands: { name: string; number: string | null; active: boolean }[]
}

export type Declaration = {
  merchant_id: string
  /** First day of the declared month, `AAAA-MM-JJ`. */
  month: string
  amount_cents: number
  updated_at: string
}

type StandRevenueRow = {
  merchantId: string
  name: string
  stands: string
  /** `AAAA-MM` of the latest declared month, null when nothing was declared. */
  lastMonth: string | null
  lastCents: number | null
  /** Variation against the month right before, only when that month was declared too. */
  trendPercent: number | null
  declaredAt: string | null
}

export type StandRevenue = {
  rows: StandRevenueRow[]
  /** One entry per declared month, with one key per merchant name (null = not declared). */
  chart: { months: Record<string, string | number | null>[]; names: string[] }
}

const monthOf = (value: string) => value.slice(0, 7)

function previousMonth(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`
}

/** Joins merchants with their declarations: the latest declared month per stand, and the curves of the whole history. */
export function buildStandRevenue(
  merchants: StandMerchant[],
  declarations: Declaration[],
  formatMonth: (month: string) => string,
): StandRevenue {
  const byMerchant = new Map<string, Map<string, Declaration>>()
  for (const declaration of declarations) {
    const months = byMerchant.get(declaration.merchant_id) ?? new Map<string, Declaration>()
    months.set(monthOf(declaration.month), declaration)
    byMerchant.set(declaration.merchant_id, months)
  }

  const visible = merchants.filter((merchant) => merchant.active || byMerchant.has(merchant.id))
  const rows: StandRevenueRow[] = visible
    .map((merchant) => {
      const months = byMerchant.get(merchant.id)
      const latest = months ? [...months.keys()].sort().at(-1) : undefined
      const last = latest ? months!.get(latest)! : null
      const before = latest ? months!.get(previousMonth(latest)) : undefined
      return {
        merchantId: merchant.id,
        name: merchant.trade_name || merchant.legal_name,
        stands: merchant.stands
          .filter((stand) => stand.active)
          .map((stand) => stand.number ? `${stand.name} (n° ${stand.number})` : stand.name)
          .join(', '),
        lastMonth: latest ?? null,
        lastCents: last?.amount_cents ?? null,
        trendPercent: last && before && before.amount_cents > 0
          ? (last.amount_cents - before.amount_cents) / before.amount_cents * 100 : null,
        declaredAt: last?.updated_at ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const named = rows.filter((row) => row.lastMonth !== null)
  const monthKeys = [...new Set(named.flatMap((row) => [...byMerchant.get(row.merchantId)!.keys()]))].sort()
  const chart = {
    names: named.map((row) => row.name),
    months: monthKeys.map((month) => {
      const point: Record<string, string | number | null> = { month: formatMonth(month) }
      for (const row of named) {
        const declaration = byMerchant.get(row.merchantId)!.get(month)
        point[row.name] = declaration ? declaration.amount_cents / 100 : null
      }
      return point
    }),
  }
  return { rows, chart }
}
