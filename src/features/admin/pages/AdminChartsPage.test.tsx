import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminChartsPage } from './AdminChartsPage'

const { mockGetAdminCharges, mockUseAdminHall } = vi.hoisted(() => ({
  mockGetAdminCharges: vi.fn(),
  mockUseAdminHall: vi.fn(),
}))

vi.mock('../AdminHallContext', () => ({
  useAdminHall: mockUseAdminHall,
}))

vi.mock('../services/adminChargeService', () => ({
  adminChargeDate: (row: { invoice_date?: string | null; period_end?: string; created_at?: string }) => (
    row.invoice_date ?? row.period_end ?? row.created_at ?? ''
  ),
  getAdminCharges: mockGetAdminCharges,
}))

vi.mock('../../../lib/env', () => ({
  getBackendUrl: () => null,
}))

vi.mock('../../../lib/supabase', () => ({
  getSupabaseClient: () => null,
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Line: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

describe('AdminChartsPage', () => {
  it('removes the text search and keeps the exhaustive invoice list visible', async () => {
    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-1', loading: false })
    mockGetAdminCharges.mockResolvedValue({
      data: [
        {
          id: 'charge-1',
          label: 'Eau',
          category: 'Eau potable',
          supplier_name: 'Veolia',
          amount_incl_tax: 42.5,
          pennylane_id: 'p-1',
          invoice_date: '2026-09-01',
          period_end: '2026-09-30',
          created_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'charge-2',
          label: 'Electricité',
          category: 'Courant',
          supplier_name: 'EDF',
          amount_incl_tax: 63.2,
          pennylane_id: 'p-2',
          invoice_date: '2026-09-06',
          period_end: '2026-09-30',
          created_at: '2026-09-06T00:00:00Z',
        },
      ],
      error: null,
    })

    render(<AdminChartsPage />)

    expect(screen.queryByLabelText(/rechercher une facture/i)).not.toBeInTheDocument()
    expect((await screen.findAllByText('Veolia')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('EDF')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Eau')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Electricité')).length).toBeGreaterThan(0)
  })
})
