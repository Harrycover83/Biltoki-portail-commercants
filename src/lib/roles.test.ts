import { describe, expect, it } from 'vitest'
import { canSyncRole as backendCanSync, USER_ROLES as BACKEND_ROLES, isStaffRole as backendIsStaff } from '../../backend/src/auth/roles'
import { canSyncRole, isStaffRole, ROLE_LABELS, ROLE_ORDER, STAFF_ROLES } from './roles'

// The frontend and the backend each keep their own copy of the role rules: these tests make sure they never drift.
describe('role rules shared with the backend', () => {
  it('knows exactly the same roles', () => {
    expect([...BACKEND_ROLES].sort()).toEqual(Object.keys(ROLE_LABELS).sort())
    expect([...BACKEND_ROLES].sort()).toEqual([...ROLE_ORDER].sort())
  })

  it('agrees on which roles are staff', () => {
    for (const role of BACKEND_ROLES) {
      expect(isStaffRole(role)).toBe(backendIsStaff(role))
    }
    expect([...STAFF_ROLES].sort()).toEqual(BACKEND_ROLES.filter((role) => backendIsStaff(role)).sort())
  })

  it('agrees on which roles may trigger a Pennylane sync', () => {
    for (const role of BACKEND_ROLES) {
      expect(canSyncRole(role)).toBe(backendCanSync(role))
    }
  })
})
