import { describe, expect, it } from 'vitest'
import { centsToEuroInput, MAX_DECLARED_CENTS, parseEuroInput } from './money'

describe('parseEuroInput', () => {
  it('reads French and plain amounts as exact cents', () => {
    expect(parseEuroInput('1234')).toBe(123_400)
    expect(parseEuroInput('1 234,5')).toBe(123_450)
    expect(parseEuroInput('1\u202f234,56 €')).toBe(123_456)
    expect(parseEuroInput('0.1')).toBe(10)
    expect(parseEuroInput('0')).toBe(0)
  })

  it('rejects negatives, extra decimals, text and absurd amounts', () => {
    for (const value of ['', '-5', '1,234', '12e3', 'abc', '1,2,3', '99999999999999999']) expect(parseEuroInput(value)).toBeNull()
    expect(parseEuroInput(String(MAX_DECLARED_CENTS / 100 + 1))).toBeNull()
  })
})

describe('centsToEuroInput', () => {
  it('round-trips with parseEuroInput', () => {
    for (const cents of [0, 5, 100, 123_450, 1_538_203]) expect(parseEuroInput(centsToEuroInput(cents))).toBe(cents)
    expect(centsToEuroInput(123_450)).toBe('1234,50')
  })
})
