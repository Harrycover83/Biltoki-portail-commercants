import type { UserRole } from '@/types/domain'

export const ROLE_LABELS: Record<UserRole, string> = {
  merchant: 'Commerçant',
  hall_manager: 'Responsable de halle',
  network_manager: 'Responsable réseau',
  hq: 'Siège',
  super_admin: 'Administrateur total',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  merchant: 'Voit ses charges et les charges communes de sa halle.',
  hall_manager: 'Manager, RX ou capitaine : consulte une seule halle.',
  network_manager: 'Consulte uniquement les halles qui lui sont attribuées.',
  hq: 'Consulte toutes les halles, sans modification.',
  super_admin: 'Voit tout et gère les comptes et leurs accès.',
}

export const ROLE_ORDER: UserRole[] = ['super_admin', 'hq', 'network_manager', 'hall_manager', 'merchant']

export const JOB_TITLE_SUGGESTIONS = ['Capitaine', 'RX (responsable d’exploitation)', 'Manager de service']

export const STAFF_ROLES: UserRole[] = ['hall_manager', 'network_manager', 'hq', 'super_admin']

export function roleLabel(role: UserRole | null | undefined): string {
  return role ? (ROLE_LABELS[role] ?? role) : 'N/A'
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role ? STAFF_ROLES.includes(role) : false
}

export function isSuperAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'super_admin'
}

/** Roles that can trigger a Pennylane sync (on their own halls). Head office stays read-only. */
export function canSyncRole(role: UserRole | null | undefined): boolean {
  return role === 'hall_manager' || role === 'network_manager' || role === 'super_admin'
}

export function homePathForRole(role: UserRole | null | undefined): string {
  return isStaffRole(role) ? '/admin/dashboard' : '/historique'
}
