import type { Logger } from '../../utils/logger.js'
import type {
  PennylaneCategory,
  PennylaneCategoryGroup,
  PennylaneFilter,
  PennylaneInvoiceLine,
  PennylaneList,
  PennylaneMe,
  PennylaneServiceCharge,
  PennylaneServiceChargesResponse,
  PennylaneSupplier,
  PennylaneSupplierInvoice,
  PennylaneWeightedCategory,
} from './types.js'

export const PENNYLANE_API_URL = 'https://app.pennylane.com/api/external/v2'

const MAX_PAGE_SIZE = 100

/**
 * Pennylane Company API v2 client.
 *
 * The token is scoped to a single Pennylane company, so one client instance
 * covers one company. Falls back to mock data when no key is configured.
 */
export class PennylaneClient {
  private readonly apiKey: string
  private readonly apiUrl: string
  private readonly logger: Logger

  constructor(apiKey: string, apiUrl: string, logger: Logger) {
    this.apiKey = apiKey
    this.apiUrl = (apiUrl || PENNYLANE_API_URL).replace(/\/+$/, '')
    this.logger = logger

    if (!apiKey) {
      this.logger.warn('⚠️  Pennylane API key not configured. Using mock data.')
    }
  }

  private async request<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Pennylane API key is not configured')
    }

    const url = new URL(`${this.apiUrl}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Pennylane ${response.status} on ${path}: ${body.slice(0, 500)}`)
    }

    return (await response.json()) as T
  }

  /** Walks every page of a cursor-paginated endpoint. Filters must be re-sent on each page. */
  private async requestAll<T>(
    path: string,
    query: Record<string, string | undefined> = {},
    maxItems = 1000,
  ): Promise<T[]> {
    const items: T[] = []
    let cursor: string | undefined

    do {
      const page = await this.request<PennylaneList<T>>(path, {
        ...query,
        limit: String(MAX_PAGE_SIZE),
        cursor,
      })

      items.push(...page.items)
      cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
    } while (cursor && items.length < maxItems)

    return items.slice(0, maxItems)
  }

  /** Confirms the token works and reveals which company it is bound to. */
  async getMe(): Promise<PennylaneMe> {
    return this.request<PennylaneMe>('/me')
  }

  async listCategoryGroups(): Promise<PennylaneCategoryGroup[]> {
    return this.requestAll<PennylaneCategoryGroup>('/category_groups')
  }

  async listCategories(): Promise<PennylaneCategory[]> {
    return this.requestAll<PennylaneCategory>('/categories')
  }

  async listSuppliers(maxItems = 500): Promise<PennylaneSupplier[]> {
    return this.requestAll<PennylaneSupplier>('/suppliers', {}, maxItems)
  }

  async listSupplierInvoices(options: {
    from?: string
    to?: string
    categoryIds?: number[]
    maxItems?: number
  } = {}): Promise<PennylaneSupplierInvoice[]> {
    const filters: PennylaneFilter[] = []

    if (options.from) {
      filters.push({ field: 'date', operator: 'gteq', value: options.from })
    }
    if (options.to) {
      filters.push({ field: 'date', operator: 'lteq', value: options.to })
    }
    if (options.categoryIds?.length) {
      filters.push({ field: 'category_id', operator: 'in', value: options.categoryIds.map(String) })
    }

    return this.requestAll<PennylaneSupplierInvoice>(
      '/supplier_invoices',
      {
        filter: filters.length > 0 ? JSON.stringify(filters) : undefined,
        sort: '-date',
      },
      options.maxItems ?? 200,
    )
  }

  async listSupplierInvoiceCategories(invoiceId: number): Promise<PennylaneWeightedCategory[]> {
    const page = await this.request<PennylaneList<PennylaneWeightedCategory>>(
      `/supplier_invoices/${invoiceId}/categories`,
      { limit: String(MAX_PAGE_SIZE) },
    )
    return page.items
  }

  async listSupplierInvoiceLines(invoiceId: number): Promise<PennylaneInvoiceLine[]> {
    const page = await this.request<PennylaneList<PennylaneInvoiceLine>>(
      `/supplier_invoices/${invoiceId}/invoice_lines`,
      { limit: String(MAX_PAGE_SIZE) },
    )
    return page.items
  }

  async fetchServiceCharges(hallId: string): Promise<PennylaneServiceChargesResponse> {
    this.logger.info(`Fetching service charges for hall: ${hallId}`)

    if (!this.apiKey) {
      return this.getMockServiceCharges()
    }

    // A Pennylane token is company-scoped and knows nothing about our hall UUIDs.
    // Refuse to guess rather than importing the wrong invoices into the portal.
    throw new Error(
      `No Pennylane mapping configured for hall ${hallId}. ` +
        'Declare which Pennylane company/analytical category feeds this hall before enabling sync.',
    )
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
