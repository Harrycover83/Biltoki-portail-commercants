export type MerchantAllocationInput = {
  merchantId: string
  linearMeters: number
  active?: boolean
}

export type MerchantAllocation = {
  merchantId: string
  linearMeters: number
  allocationBasisPoints: number
  allocatedAmountCents: number
}

function ensureFiniteNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} doit être un nombre fini`)
  }

  if (value < 0) {
    throw new Error(`${fieldName} ne peut pas être négatif`)
  }
}

export function allocateLinearMeterCharges(
  amountCents: number,
  merchants: MerchantAllocationInput[],
): MerchantAllocation[] {
  ensureFiniteNumber(amountCents, 'amountCents')

  if (!Number.isInteger(amountCents)) {
    throw new Error('amountCents doit être exprimé en centimes entiers')
  }

  const activeMerchants = merchants.filter((merchant) => merchant.active !== false)

  if (activeMerchants.length === 0) {
    return []
  }

  for (const merchant of activeMerchants) {
    ensureFiniteNumber(merchant.linearMeters, 'linearMeters')
  }

  const totalLinearMeters = activeMerchants.reduce((sum, merchant) => sum + merchant.linearMeters, 0)

  if (totalLinearMeters === 0) {
    throw new Error('Le total des mètres linéaires doit être supérieur à 0')
  }

  const rawShares = activeMerchants.map((merchant) => {
    const ratio = merchant.linearMeters / totalLinearMeters
    const rawAmount = amountCents * ratio

    return {
      merchant,
      ratio,
      floorCents: Math.floor(rawAmount),
      remainder: rawAmount - Math.floor(rawAmount),
    }
  })

  let allocatedSum = rawShares.reduce((sum, share) => sum + share.floorCents, 0)
  let remaining = amountCents - allocatedSum

  rawShares.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder
    }

    return a.merchant.merchantId.localeCompare(b.merchant.merchantId)
  })

  for (const share of rawShares) {
    if (remaining <= 0) {
      break
    }

    share.floorCents += 1
    remaining -= 1
    allocatedSum += 1
  }

  if (allocatedSum !== amountCents) {
    throw new Error('La somme des allocations ne correspond pas au montant total')
  }

  return rawShares
    .map((share) => ({
      merchantId: share.merchant.merchantId,
      linearMeters: share.merchant.linearMeters,
      allocationBasisPoints: Math.round((share.ratio * 10_000 + Number.EPSILON) * 100) / 100,
      allocatedAmountCents: share.floorCents,
    }))
    .sort((a, b) => a.merchantId.localeCompare(b.merchantId))
}
