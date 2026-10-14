import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminRevenuePage } from './AdminRevenuePage'

const { mockUseAdminHall, mockGet } = vi.hoisted(() => ({ mockUseAdminHall: vi.fn(), mockGet: vi.fn() }))

vi.mock('@/features/admin/AdminHallContext', () => ({ useAdminHall: mockUseAdminHall }))
vi.mock('@/features/admin/services/adminRevenueService', () => ({ getHallDeclaredRevenue: mockGet }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, Legend: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

const merchants = [
  { id: 'a', legal_name: 'All Angus SAS', trade_name: 'All Angus', active: true, stands: [{ name: 'A1', number: null, active: true }] },
  { id: 'b', legal_name: 'Balme SAS', trade_name: 'Balme', active: true, stands: [{ name: 'B1', number: null, active: true }] },
]

describe('Admin stands revenue page', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function setup() {
    mockUseAdminHall.mockReturnValue({ halls: [{ id: 'h1', name: 'Halle Toulon' }], selectedHallId: 'h1', loading: false })
  }

  it('lists the stands with their last declared revenue, the table before the chart', async () => {
    setup()
    mockGet.mockResolvedValue({
      data: { merchants, declarations: [
        { merchant_id: 'a', month: '2026-08-01', amount_cents: 400_000, updated_at: '2026-09-02T09:00:00Z' },
        { merchant_id: 'a', month: '2026-09-01', amount_cents: 500_000, updated_at: '2026-10-02T09:00:00Z' },
      ] },
      error: null,
    })
    render(<AdminRevenuePage />)

    expect(await screen.findByText('All Angus')).toBeTruthy()
    expect(screen.getByText(/5\s000,00\s€/)).toBeTruthy()
    expect(screen.getByText('+25 %')).toBeTruthy()
    expect(screen.getByText('Aucun CA saisi')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('h1')

    const table = screen.getByRole('table')
    const chart = screen.getByLabelText(/Courbes d'évolution/)
    expect(table.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Falafels')).toBeNull()
  })

  it('shows no chart while nobody declared anything', async () => {
    setup()
    mockGet.mockResolvedValue({ data: { merchants, declarations: [] }, error: null })
    render(<AdminRevenuePage />)

    expect(await screen.findAllByText('Aucun CA saisi')).toHaveLength(2)
    expect(screen.queryByLabelText(/Courbes d'évolution/)).toBeNull()
  })

  it('surfaces loading errors instead of showing figures', async () => {
    setup()
    mockGet.mockResolvedValue({ data: null, error: 'permission denied' })
    render(<AdminRevenuePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
  })
})
