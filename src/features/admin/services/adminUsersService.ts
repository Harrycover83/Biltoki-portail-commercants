import { getBackendUrl } from '@/lib/env'
import { getAccessToken } from '@/lib/session'
import type { UserRole } from '@/types/domain'

export type ManagedUser = {
  userId: string | null
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  jobTitle: string | null
  merchantId: string | null
  hallIds: string[]
  active: boolean
  provisioned: boolean
  lastSignInAt: string | null
}

export type AdminOptions = {
  halls: { id: string; name: string }[]
  merchants: { id: string; name: string; hallId: string }[]
}

export type AuditEntry = {
  id: string
  actor_email: string | null
  action: string
  target_email: string | null
  created_at: string
}

export type UserFormValues = {
  email: string
  firstName: string
  lastName: string
  role: UserRole
  jobTitle: string
  merchantId: string
  hallIds: string[]
}

type ApiResult<T> = { data: T | null; error: string | null }

export function emptyUserForm(): UserFormValues {
  return { email: '', firstName: '', lastName: '', role: 'hall_manager', jobTitle: '', merchantId: '', hallIds: [] }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const backendUrl = getBackendUrl()
  if (!backendUrl) {
    return { data: null, error: 'VITE_BACKEND_URL non configure.' }
  }

  const token = await getAccessToken()
  if (!token) {
    return { data: null, error: 'Session introuvable, reconnectez-vous.' }
  }

  try {
    const response = await fetch(`${backendUrl}/api/admin${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { data: null, error: typeof body.error === 'string' ? body.error : `Échec (HTTP ${response.status})` }
    }
    return { data: body as T, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Erreur réseau' }
  }
}

function toPayload(values: UserFormValues, withEmail: boolean) {
  return {
    ...(withEmail ? { email: values.email } : {}),
    firstName: values.firstName,
    lastName: values.lastName,
    role: values.role,
    jobTitle: values.jobTitle || null,
    merchantId: values.role === 'merchant' ? values.merchantId || null : null,
    hallIds: values.role === 'hall_manager' || values.role === 'network_manager' ? values.hallIds : [],
  }
}

export const adminUsersService = {
  listUsers: () => request<{ users: ManagedUser[] }>('/users'),
  getOptions: () => request<AdminOptions>('/options'),
  listAudit: () => request<{ entries: AuditEntry[] }>('/audit'),
  createUser: (values: UserFormValues) =>
    request<{ userId: string; provisionalPassword: string }>('/users', {
      method: 'POST',
      body: toPayload(values, true),
    }),
  updateUser: (userId: string, values: UserFormValues) =>
    request<{ ok: true }>(`/users/${userId}`, { method: 'PATCH', body: toPayload(values, false) }),
  setActive: (userId: string, active: boolean) =>
    request<{ ok: true }>(`/users/${userId}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  resetPassword: (userId: string) =>
    request<{ provisionalPassword: string }>(`/users/${userId}/reset-password`, { method: 'POST' }),
  deleteUser: (userId: string) => request<{ ok: true }>(`/users/${userId}`, { method: 'DELETE' }),
}
