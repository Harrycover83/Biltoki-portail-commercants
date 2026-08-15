import type { Logger } from '../../utils/logger'
import type { PennylaneServiceCharge, PennylaneServiceChargesResponse } from './types'

/**
 * Mock Pennylane API Client
 * 
 * Returns simulated data that matches real Pennylane API response format.
 * Replace with real HTTP client when PENNYLANE_API_KEY is available.
 */
export class PennylaneClient {
  private readonly apiKey: string
  private readonly apiUrl: string
  private readonly logger: Logger

  constructor(apiKey: string, apiUrl: string, logger: Logger) {
    this.apiKey = apiKey
    this.apiUrl = apiUrl
    this.logger = logger

    if (!apiKey) {
      this.logger.warn('⚠️  Pennylane API key not configured. Using mock data.')
    }
  }

  async fetchServiceCharges(hallId: string): Promise<PennylaneServiceChargesResponse> {
    this.logger.info(`Fetching service charges for hall: ${hallId}`)

    // MOCK DATA - Replace with real API call when key is available
    if (!this.apiKey) {
      return this.getMockServiceCharges()
    }

    // TODO: Real API implementation
    // const response = await fetch(`${this.apiUrl}/service_charges`, {
    //   headers: { 'Authorization': `Bearer ${this.apiKey}` }
    // })
    // return response.json()

    return this.getMockServiceCharges()
  }

  private getMockServiceCharges(): PennylaneServiceChargesResponse {
    const mockData: PennylaneServiceCharge[] = [
      {
        id: 'PLN-2026-08-001',
        label: 'Nettoyage des locaux',
        categoryLabel: 'Opérations',
        amountExclTax: 3500.0,
        taxAmount: 700.0,
        amountInclTax: 4200.0,
        taxRate: 20,
        description: 'Nettoyage hall Toulon - Août 2026',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'PLN-2026-08-002',
        label: 'Sécurité et surveillance',
        categoryLabel: 'Opérations',
        amountExclTax: 1800.0,
        taxAmount: 360.0,
        amountInclTax: 2160.0,
        taxRate: 20,
        description: 'Sécurité hall - Août 2026',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'PLN-2026-08-003',
        label: 'Maintenance équipements',
        categoryLabel: 'Maintenance',
        amountExclTax: 2250.0,
        taxAmount: 450.0,
        amountInclTax: 2700.0,
        taxRate: 20,
        description: 'Maintenance frigos et systèmes - Août 2026',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'PLN-2026-08-004',
        label: 'Assurance locaux',
        categoryLabel: 'Assurance',
        amountExclTax: 500.0,
        taxAmount: 100.0,
        amountInclTax: 600.0,
        taxRate: 20,
        description: 'Assurance immeuble - Août 2026',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'PLN-2026-08-005',
        label: 'Eau et électricité',
        categoryLabel: 'Services',
        amountExclTax: 1950.0,
        taxAmount: 390.0,
        amountInclTax: 2340.0,
        taxRate: 20,
        description: 'Consommations - Août 2026',
        createdAt: new Date().toISOString(),
      },
    ]

    this.logger.debug(`Mock: Returning ${mockData.length} service charges`)

    return {
      charges: mockData,
      totalCount: mockData.length,
      hasMore: false,
    }
  }

  getConfig(): { apiUrl: string; hasApiKey: boolean } {
    return {
      apiUrl: this.apiUrl,
      hasApiKey: Boolean(this.apiKey),
    }
  }
}
