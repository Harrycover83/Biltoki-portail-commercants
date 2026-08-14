import { describe, expect, it } from 'vitest'
import { calculateAllocations } from './calculateAllocations'

describe('calculateAllocations', () => {
  it('calculates 4/20, 6/20 and 10/20 correctly', () => {
    const result = calculateAllocations(1_000_000, [
      { merchantId: 'A', linearMetersMilli: 4_000 },
      { merchantId: 'B', linearMetersMilli: 6_000 },
      { merchantId: 'C', linearMetersMilli: 10_000 },
    ])

    const a = result.results.find((row) => row.merchantId === 'A')
    const b = result.results.find((row) => row.merchantId === 'B')
    const c = result.results.find((row) => row.merchantId === 'C')

    expect(a?.allocationBps).toBe(2000)
    expect(b?.allocationBps).toBe(3000)
    expect(c?.allocationBps).toBe(5000)

    expect(a?.allocatedCents).toBe(200000)
    expect(b?.allocatedCents).toBe(300000)
    expect(c?.allocatedCents).toBe(500000)
  })

  it('returns zero allocations when total linear meters is zero', () => {
    const result = calculateAllocations(100_000, [
      { merchantId: 'A', linearMetersMilli: 0 },
      { merchantId: 'B', linearMetersMilli: 0 },
    ])

    expect(result.results[0]?.allocatedCents).toBe(0)
    expect(result.results[1]?.allocatedCents).toBe(0)
    expect(result.roundingDeltaCents).toBe(100000)
  })

  it('keeps total allocated equal to total charge with deterministic rounding', () => {
    const result = calculateAllocations(100, [
      { merchantId: 'A', linearMetersMilli: 1 },
      { merchantId: 'B', linearMetersMilli: 1 },
      { merchantId: 'C', linearMetersMilli: 1 },
    ])

    const total = result.results.reduce((sum, row) => sum + row.allocatedCents, 0)
    expect(total).toBe(100)
    expect(result.roundingDeltaCents).toBe(0)
  })

  it('rejects negative values', () => {
    expect(() =>
      calculateAllocations(100, [{ merchantId: 'A', linearMetersMilli: -1 }]),
    ).toThrowError(/linearMetersMilli/)

    expect(() => calculateAllocations(-100, [])).toThrowError(/totalChargeCents/)
  })
})
