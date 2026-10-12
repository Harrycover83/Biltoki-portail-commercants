import { getBackendUrl } from '@/lib/env'
import { getAccessToken } from '@/lib/session'

export type RevenueComparison = {
  hallId: string
  source: 'Popina'
  fetchedAt: string
  since: string
  until: string
  totalCurrentCents: number | null
  totalPreviousCents: number | null
  comparableDays: number
  comparableCurrentCents: number | null
  comparablePreviousCents: number | null
  trendPercent: number | null
  daily: { date: string; previousDate: string | null; currentCents: number | null; previousCents: number | null }[]
}

export function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function defaultRevenuePeriod(): { since: string; until: string } {
  const until = new Date(Date.parse(parisToday()) - 86_400_000).toISOString().slice(0, 10)
  return { since: `${until.slice(0, 7)}-01`, until }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nullableCents(value: unknown): boolean {
  return value === null || Number.isSafeInteger(value)
}

function isComparison(value: unknown): value is RevenueComparison {
  return record(value) && typeof value.hallId === 'string' && value.source === 'Popina' &&
    typeof value.fetchedAt === 'string' && typeof value.since === 'string' && typeof value.until === 'string' &&
    nullableCents(value.totalCurrentCents) && nullableCents(value.totalPreviousCents) &&
    nullableCents(value.comparableCurrentCents) && nullableCents(value.comparablePreviousCents) &&
    Number.isSafeInteger(value.comparableDays) &&
    (value.trendPercent === null || (typeof value.trendPercent === 'number' && Number.isFinite(value.trendPercent))) &&
    Array.isArray(value.daily) && value.daily.every((day: unknown) => record(day) &&
      typeof day.date === 'string' && (day.previousDate === null || typeof day.previousDate === 'string') &&
      nullableCents(day.currentCents) && nullableCents(day.previousCents))
}

export async function fetchRevenue(hallId: string, since: string, until: string, signal: AbortSignal): Promise<RevenueComparison> {
  const backend = getBackendUrl()
  if (!backend) throw new Error('Service Popina non configuré : l’URL du backend est absente.')
  const token = await getAccessToken()
  if (!token) throw new Error('Session introuvable, reconnectez-vous.')
  const query = new URLSearchParams({ since, until })
  const response = await fetch(`${backend}/api/popina/${encodeURIComponent(hallId)}/revenue?${query}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    throw new Error(record(body) && typeof body.error === 'string' ? body.error : `Popina indisponible (HTTP ${response.status}).`)
  }
  if (!isComparison(body) || body.hallId !== hallId || body.since !== since || body.until !== until) {
    throw new Error('Réponse du service Popina invalide.')
  }
  return body
}
