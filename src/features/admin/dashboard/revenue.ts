import { getBackendUrl } from '@/lib/env'
import { getAccessToken } from '@/lib/session'

export type DailyRevenue = {
  hallId: string
  source: 'Popina'
  fetchedAt: string
  since: string
  until: string
  days: { date: string; cents: number | null }[]
}

export function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** The last closed day: Popina revenue is only final once the day is over. */
export function parisYesterday(): string {
  return new Date(Date.parse(parisToday()) - 86_400_000).toISOString().slice(0, 10)
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDailyRevenue(value: unknown): value is DailyRevenue {
  return record(value) && typeof value.hallId === 'string' && value.source === 'Popina' &&
    typeof value.fetchedAt === 'string' && typeof value.since === 'string' && typeof value.until === 'string' &&
    Array.isArray(value.days) && value.days.every((day: unknown) => record(day) &&
      typeof day.date === 'string' && (day.cents === null || Number.isSafeInteger(day.cents)))
}

export async function fetchDailyRevenue(hallId: string, since: string, until: string, signal: AbortSignal): Promise<DailyRevenue> {
  const backend = getBackendUrl()
  if (!backend) throw new Error('Service Popina non configuré : l’URL du backend est absente.')
  const token = await getAccessToken()
  if (!token) throw new Error('Session introuvable, reconnectez-vous.')
  const query = new URLSearchParams({ since, until })
  const response = await fetch(`${backend}/api/popina/${encodeURIComponent(hallId)}/revenue/daily?${query}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    throw new Error(record(body) && typeof body.error === 'string' ? body.error : `Popina indisponible (HTTP ${response.status}).`)
  }
  if (!isDailyRevenue(body) || body.hallId !== hallId || body.since !== since || body.until !== until) {
    throw new Error('Réponse du service Popina invalide.')
  }
  return body
}
