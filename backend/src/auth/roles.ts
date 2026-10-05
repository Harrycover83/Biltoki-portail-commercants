export const USER_ROLES = ['merchant', 'hall_manager', 'network_manager', 'hq', 'super_admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Roles bound to a list of halls stored in admin_hall_permissions. */
const HALL_SCOPED_ROLES: readonly UserRole[] = ['hall_manager', 'network_manager']

/** Roles that see every hall. */
const GLOBAL_ROLES: readonly UserRole[] = ['hq', 'super_admin']

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function isStaffRole(role: unknown): boolean {
  return isUserRole(role) && role !== 'merchant'
}

/** Roles allowed to trigger a Pennylane sync (on their own halls). Head office stays read-only. */
export function canSyncRole(role: unknown): boolean {
  return role === 'hall_manager' || role === 'network_manager' || role === 'super_admin'
}

export function isGlobalRole(role: unknown): boolean {
  return isUserRole(role) && GLOBAL_ROLES.includes(role)
}

export function isHallScopedRole(role: unknown): boolean {
  return isUserRole(role) && HALL_SCOPED_ROLES.includes(role)
}
