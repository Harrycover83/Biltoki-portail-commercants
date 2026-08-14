export class PennylaneClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  getConfig(): { baseUrl: string; hasApiKey: boolean } {
    return {
      baseUrl: this.baseUrl,
      hasApiKey: Boolean(this.apiKey),
    }
  }

  async fetchServiceCharges(): Promise<never> {
    throw new Error(
      'Pennylane API endpoints are intentionally not implemented yet. Confirm official API documentation and business mapping first.',
    )
  }
}
