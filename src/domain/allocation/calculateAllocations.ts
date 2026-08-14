export type AllocationInput = {
  merchantId: string
  linearMetersMilli: number
}

export type AllocationResult = {
  merchantId: string
  allocationBps: number
  allocatedCents: number
}

export type AllocationComputation = {
  totalLinearMetersMilli: number
  results: AllocationResult[]
  roundingDeltaCents: number
}

function assertNonNegative(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative finite number`)
  }
}

export function calculateAllocations(
  totalChargeCents: number,
  merchants: AllocationInput[],
): AllocationComputation {
  assertNonNegative(totalChargeCents, 'totalChargeCents')

  if (merchants.length === 0) {
    return { totalLinearMetersMilli: 0, results: [], roundingDeltaCents: totalChargeCents }
  }

  merchants.forEach((merchant) => {
    assertNonNegative(merchant.linearMetersMilli, 'linearMetersMilli')
  })

  const totalLinearMetersMilli = merchants.reduce((sum, row) => sum + row.linearMetersMilli, 0)
  if (totalLinearMetersMilli <= 0) {
    return {
      totalLinearMetersMilli,
      results: merchants.map((merchant) => ({
        merchantId: merchant.merchantId,
        allocationBps: 0,
        allocatedCents: 0,
      })),
      roundingDeltaCents: totalChargeCents,
    }
  }

  const provisional = merchants.map((merchant) => {
    const ratio = merchant.linearMetersMilli / totalLinearMetersMilli
    const exact = totalChargeCents * ratio
    const floorCents = Math.floor(exact)
    const remainder = exact - floorCents

    return {
      merchantId: merchant.merchantId,
      ratio,
      floorCents,
      remainder,
      allocationBps: Math.round(ratio * 10000),
    }
  })

  const floorSum = provisional.reduce((sum, row) => sum + row.floorCents, 0)
  let delta = totalChargeCents - floorSum

  const ordered = [...provisional].sort((a, b) => {
    if (b.remainder === a.remainder) {
      return a.merchantId.localeCompare(b.merchantId)
    }
    return b.remainder - a.remainder
  })

  const topUp = new Map<string, number>()
  while (delta > 0) {
    for (const row of ordered) {
      if (delta <= 0) {
        break
      }
      topUp.set(row.merchantId, (topUp.get(row.merchantId) ?? 0) + 1)
      delta -= 1
    }
  }

  const results = provisional.map((row) => ({
    merchantId: row.merchantId,
    allocationBps: row.allocationBps,
    allocatedCents: row.floorCents + (topUp.get(row.merchantId) ?? 0),
  }))

  const allocatedTotal = results.reduce((sum, row) => sum + row.allocatedCents, 0)

  return {
    totalLinearMetersMilli,
    results,
    roundingDeltaCents: totalChargeCents - allocatedTotal,
  }
}
