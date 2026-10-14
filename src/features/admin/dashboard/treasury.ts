import { getBackendUrl } from '@/lib/env'
import { getAccessToken } from '@/lib/session'

export type Treasury = {
  hallId: string
  source: 'Pennylane'
  fetchedAt: string
  proAccount: { name: string; currency: string; balanceCents: number; updatedAt: string } | null
  invoicesToApprove: { count: number; totalCents: number; truncated: boolean }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isTreasury(value: unknown): value is Treasury {
  if (!record(value) || value.source !== 'Pennylane' || typeof value.hallId !== 'string' || typeof value.fetchedAt !== 'string') return false
  const account = value.proAccount
  const invoices = value.invoicesToApprove
  return (account === null || (record(account) && typeof account.name === 'string' && typeof account.updatedAt === 'string' &&
      typeof account.currency === 'string' && Number.isSafeInteger(account.balanceCents))) &&
    record(invoices) && Number.isSafeInteger(invoices.count) && Number.isSafeInteger(invoices.totalCents) &&
    typeof invoices.truncated === 'boolean'
}

export async function fetchTreasury(hallId: string, signal: AbortSignal, refresh = false): Promise<Treasury> {
  const backend = getBackendUrl()
  if (!backend) throw new Error('Service Pennylane non configuré : l’URL du backend est absente.')
  const token = await getAccessToken()
  if (!token) throw new Error('Session introuvable, reconnectez-vous.')
  const response = await fetch(`${backend}/api/pennylane/${encodeURIComponent(hallId)}/treasury${refresh ? '?refresh=1' : ''}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    throw new Error(record(body) && typeof body.error === 'string' ? body.error : `Pennylane indisponible (HTTP ${response.status}).`)
  }
  if (!isTreasury(body) || body.hallId !== hallId) throw new Error('Réponse du service Pennylane invalide.')
  return body
}
