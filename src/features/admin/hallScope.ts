import type { UserRole } from '@/types/domain'

export type HallOption = { id: string; name: string }

const STORAGE_PREFIX = 'biltoki-admin-selected-hall'

/** The remembered hall belongs to one account: two users sharing a browser never inherit each other's choice. */
export function hallStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

/**
 * Keeps only the halls an account is attached to. The database policies already filter the list; this is a
 * second guard for hall-scoped roles. `permittedHallIds` is null when the permissions could not be read, in
 * which case the policy-filtered list is kept as is.
 */
export function scopeHalls<T extends HallOption>(
  role: UserRole | null | undefined,
  halls: T[],
  permittedHallIds: string[] | null,
): T[] {
  if ((role === 'hall_manager' || role === 'network_manager') && permittedHallIds) {
    return halls.filter((hall) => permittedHallIds.includes(hall.id))
  }
  return halls
}

export function pickInitialHallId(halls: HallOption[], storedHallId: string | null): string {
  return halls.find((hall) => hall.id === storedHallId)?.id ?? halls[0]?.id ?? ''
}

/** Wording of the hall bar, adapted to what the account is allowed to see. */
export function hallBarLabel(role: UserRole | null | undefined, hallCount: number): string {
  if (role === 'hall_manager') return 'Ma halle'
  if (hallCount === 1) return 'Halle'
  if (role === 'network_manager') return 'Mes halles'
  return 'Halle observée'
}
