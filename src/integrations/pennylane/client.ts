import type { PennylaneRequestOptions } from './types'

export class PennylaneClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async request<T>(path: string, options: PennylaneRequestOptions = {}): Promise<T> {
    const url = new URL(path, this.baseUrl)

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: 'Bearer ' + this.apiKey,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`Pennylane API error ${response.status}`)
    }

    return (await response.json()) as T
  }
}
