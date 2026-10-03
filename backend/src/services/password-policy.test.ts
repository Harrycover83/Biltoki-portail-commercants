import { describe, expect, it } from 'vitest'
import { validatePassword } from './password-policy.js'

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('Correct-Horse-9')).toBeNull()
  })

  it('rejects weak or malformed passwords', () => {
    for (const weak of ['short1A!', 'alllowercase123!', 'ALLUPPERCASE123!', 'NoDigitsHere!!!!', 'NoSpecial12345A', '', null, 42, 'A1!a'.repeat(40)]) {
      expect(validatePassword(weak)).not.toBeNull()
    }
  })
})
