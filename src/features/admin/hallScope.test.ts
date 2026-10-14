import { describe, expect, it } from 'vitest'
import { hallBarLabel, hallStorageKey, pickInitialHallId, scopeHalls } from './hallScope'

const HALLS = [
  { id: 'h1', name: 'Toulon' },
  { id: 'h2', name: 'Nice' },
  { id: 'h3', name: 'Lyon' },
]

describe('scopeHalls', () => {
  it('keeps only the permitted halls for hall-scoped roles', () => {
    expect(scopeHalls('network_manager', HALLS, ['h1', 'h3']).map((hall) => hall.id)).toEqual(['h1', 'h3'])
    expect(scopeHalls('hall_manager', HALLS, ['h2']).map((hall) => hall.id)).toEqual(['h2'])
  })

  it('keeps the policy-filtered list when permissions are unreadable or the role is global', () => {
    expect(scopeHalls('network_manager', HALLS, null)).toEqual(HALLS)
    expect(scopeHalls('hq', HALLS, ['h1'])).toEqual(HALLS)
    expect(scopeHalls('super_admin', HALLS, null)).toEqual(HALLS)
  })
})

describe('pickInitialHallId', () => {
  it('restores a remembered hall that is still accessible, else the first hall', () => {
    expect(pickInitialHallId(HALLS, 'h2')).toBe('h2')
    expect(pickInitialHallId(HALLS, 'gone')).toBe('h1')
    expect(pickInitialHallId(HALLS, null)).toBe('h1')
  })

  it('returns no hall rather than a fake one when none is accessible', () => {
    expect(pickInitialHallId([], 'h1')).toBe('')
  })
})

describe('hallBarLabel / hallStorageKey', () => {
  it('adapts the wording to the profile', () => {
    expect(hallBarLabel('hall_manager', 1)).toBe('Ma halle')
    expect(hallBarLabel('network_manager', 3)).toBe('Mes halles')
    expect(hallBarLabel('network_manager', 1)).toBe('Halle')
    expect(hallBarLabel('hq', 5)).toBe('Halle observée')
  })

  it('isolates the remembered hall per account', () => {
    expect(hallStorageKey('a')).not.toBe(hallStorageKey('b'))
  })
})
