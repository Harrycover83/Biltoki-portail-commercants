import { describe, expect, it } from 'vitest'
import { allocateLinearMeterCharges } from './allocation'

describe('allocateLinearMeterCharges', () => {
  it('répartit 4/6/10 mètres sur 10 000 €', () => {
    const allocations = allocateLinearMeterCharges(1_000_000, [
      { merchantId: 'A', linearMeters: 4 },
      { merchantId: 'B', linearMeters: 6 },
      { merchantId: 'C', linearMeters: 10 },
    ])

    expect(allocations).toEqual([
      { merchantId: 'A', linearMeters: 4, allocationBasisPoints: 2000, allocatedAmountCents: 200000 },
      { merchantId: 'B', linearMeters: 6, allocationBasisPoints: 3000, allocatedAmountCents: 300000 },
      { merchantId: 'C', linearMeters: 10, allocationBasisPoints: 5000, allocatedAmountCents: 500000 },
    ])
  })

  it('retourne des allocations à 0 si frais communs = 0', () => {
    const allocations = allocateLinearMeterCharges(0, [
      { merchantId: 'A', linearMeters: 4 },
      { merchantId: 'B', linearMeters: 6 },
    ])

    expect(allocations.map((allocation) => allocation.allocatedAmountCents)).toEqual([0, 0])
  })

  it('refuse un total de mètres linéaires égal à 0', () => {
    expect(() =>
      allocateLinearMeterCharges(1000, [
        { merchantId: 'A', linearMeters: 0 },
        { merchantId: 'B', linearMeters: 0 },
      ]),
    ).toThrow('Le total des mètres linéaires doit être supérieur à 0')
  })

  it('refuse les valeurs négatives', () => {
    expect(() => allocateLinearMeterCharges(-1, [{ merchantId: 'A', linearMeters: 4 }])).toThrow(
      'amountCents ne peut pas être négatif',
    )
    expect(() => allocateLinearMeterCharges(10, [{ merchantId: 'A', linearMeters: -2 }])).toThrow(
      'linearMeters ne peut pas être négatif',
    )
  })

  it('ignore les commerçants inactifs', () => {
    const allocations = allocateLinearMeterCharges(100, [
      { merchantId: 'A', linearMeters: 4, active: false },
      { merchantId: 'B', linearMeters: 6, active: true },
    ])

    expect(allocations).toHaveLength(1)
    expect(allocations[0]?.merchantId).toBe('B')
    expect(allocations[0]?.allocatedAmountCents).toBe(100)
  })

  it('gère les arrondis de manière déterministe sans perte de centime', () => {
    const allocations = allocateLinearMeterCharges(100, [
      { merchantId: 'A', linearMeters: 1 },
      { merchantId: 'B', linearMeters: 1 },
      { merchantId: 'C', linearMeters: 1 },
    ])

    const total = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmountCents, 0)
    expect(total).toBe(100)
    expect(allocations).toEqual([
      { merchantId: 'A', linearMeters: 1, allocationBasisPoints: 3333.33, allocatedAmountCents: 34 },
      { merchantId: 'B', linearMeters: 1, allocationBasisPoints: 3333.33, allocatedAmountCents: 33 },
      { merchantId: 'C', linearMeters: 1, allocationBasisPoints: 3333.33, allocatedAmountCents: 33 },
    ])
  })
})
