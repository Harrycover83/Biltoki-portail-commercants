const POPINA_API_URL = 'https://api.pragma-project.dev'

export type PopinaReport = {
  id: string
  locationId: string
  startedAt: string
  finalizedAt: string
  totalSales: number
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
}

function isReport(value: unknown): value is PopinaReport {
  return record(value) && typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.locationId === 'string' && timestamp(value.startedAt) && timestamp(value.finalizedAt) &&
    Number.isSafeInteger(value.totalSales)
}

export class PopinaClient {
  constructor(private readonly apiKey: string) {}

  private async get(path: string, signal: AbortSignal): Promise<unknown> {
    if (!this.apiKey.trim()) throw new Error('Popina API key is not configured')
    const response = await fetch(`${POPINA_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
      redirect: 'error',
      signal,
    })
    // Never include the upstream response body or request headers: they may contain secrets.
    if (!response.ok) throw new Error(`Popina request failed (HTTP ${response.status})`)
    return response.json()
  }

  async getLocation(): Promise<{ id: string; name: string; city: string }> {
    const body = await this.get('/v1/locations/own', AbortSignal.timeout(15_000))
    if (!record(body) || typeof body.id !== 'string' || typeof body.name !== 'string' || typeof body.city !== 'string') {
      throw new Error('Invalid Popina location response')
    }
    return { id: body.id, name: body.name, city: body.city }
  }

  async getReports(since: string, until: string, locationId: string): Promise<PopinaReport[]> {
    const reports = new Map<string, PopinaReport>()
    const signal = AbortSignal.timeout(30_000)
    let expectedCount: number | undefined
    for (let index = 0; index < 100; index += 1) {
      const query = new URLSearchParams({ since, until, index: String(index), size: '100' })
      const body = await this.get(`/v1/reports/?${query}`, signal)
      if (!record(body) || !Array.isArray(body.data) || !record(body.meta) ||
        !Number.isSafeInteger(body.meta.totalCount) || Number(body.meta.totalCount) < 0 ||
        !Number.isSafeInteger(body.meta.totalPage) || Number(body.meta.totalPage) < 0) {
        throw new Error('Invalid Popina reports response')
      }
      const totalCount = Number(body.meta.totalCount)
      const totalPage = Number(body.meta.totalPage)
      if (expectedCount !== undefined && expectedCount !== totalCount) {
        throw new Error('Popina reports changed during pagination; retry the request')
      }
      expectedCount = totalCount
      for (const report of body.data) {
        if (!isReport(report)) throw new Error('Invalid Popina report')
        if (report.locationId !== locationId) throw new Error('Popina location does not match the configured hall')
        if (reports.has(report.id)) throw new Error('Duplicate Popina report during pagination')
        reports.set(report.id, report)
      }
      if (index + 1 >= totalPage) {
        if (reports.size !== totalCount) throw new Error('Incomplete Popina reports response')
        return [...reports.values()]
      }
      if (body.data.length === 0) throw new Error('Incomplete Popina pagination')
    }
    throw new Error('Popina pagination limit exceeded')
  }
}
