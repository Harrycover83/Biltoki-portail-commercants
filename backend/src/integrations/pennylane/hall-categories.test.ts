import { describe, expect, it } from 'vitest'
import { DEFAULT_HALL_CATEGORIES, parseHallCategories } from './hall-categories.js'

describe('parseHallCategories', () => {
  it('returns nothing when the variable is empty', () => {
    expect(parseHallCategories('')).toEqual({})
    expect(parseHallCategories('   ')).toEqual({})
  })

  it('parses a valid mapping', () => {
    const raw = JSON.stringify({ 'hall-2': { categoryId: 42, label: '4106' } })
    expect(parseHallCategories(raw)).toEqual({ 'hall-2': { categoryId: 42, label: '4106' } })
  })

  it('rejects malformed input with an explicit message', () => {
    expect(() => parseHallCategories('{nope')).toThrow('valid JSON')
    expect(() => parseHallCategories('[]')).toThrow('object keyed by hall UUID')
    expect(() => parseHallCategories('{"h":{"categoryId":"x","label":"l"}}')).toThrow('invalid mapping for hall h')
    expect(() => parseHallCategories('{"h":{"categoryId":1}}')).toThrow('invalid mapping for hall h')
  })

  it('ships a default mapping for the pilot hall', () => {
    expect(Object.keys(DEFAULT_HALL_CATEGORIES)).toHaveLength(1)
  })
})
