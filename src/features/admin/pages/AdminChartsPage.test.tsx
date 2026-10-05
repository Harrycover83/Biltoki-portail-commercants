import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminChartsPage } from './AdminChartsPage'
import type { AdminChargeRow } from '@/features/admin/services/adminChargeService'

const { mockGetAdminCharges, mockUseAdminHall } = vi.hoisted(() => ({
  mockGetAdminCharges: vi.fn(),
  mockUseAdminHall: vi.fn(),
}))

vi.mock('@/features/admin/AdminHallContext', () => ({
  useAdminHall: mockUseAdminHall,
}))

vi.mock('@/features/admin/services/adminChargeService', () => ({
  adminChargeDate: (row: { invoice_date?: string | null; period_end?: string; created_at?: string }) => (
    row.invoice_date ?? row.period_end ?? row.created_at ?? ''
  ),
  getAdminCharges: mockGetAdminCharges,
}))

vi.mock('@/lib/env', () => ({
  getBackendUrl: () => null,
}))

vi.mock('@/lib/supabase', () => ({
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

const charge: AdminChargeRow = {
  id: 'charge-1',
  label: 'Eau',
  category: 'Eau potable',
  supplier_name: 'Veolia',
  amount_incl_tax: 42.5,
  pennylane_id: 'p-1',
  invoice_date: '2026-09-01',
  period_end: '2026-09-30',
  created_at: '2026-09-01T00:00:00Z',
}

function pendingCharges() {
  let resolve!: (result: { data: AdminChargeRow[] | null; error: string | null }) => void
  const promise = new Promise<{ data: AdminChargeRow[] | null; error: string | null }>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('AdminChartsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-1', loading: false })
    mockGetAdminCharges.mockResolvedValue({ data: [charge], error: null })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

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

  it.each(['interval', 'focus'])('keeps the chart mounted and filters intact during a %s refresh', async (trigger) => {
    vi.useFakeTimers()
    const refresh = pendingCharges()
    mockGetAdminCharges.mockResolvedValueOnce({ data: [charge], error: null })
      .mockReturnValueOnce(refresh.promise)

    render(<AdminChartsPage />)
    expect(screen.getByText('Chargement des factures...')).toBeInTheDocument()
    await act(async () => {})

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Liste de tous les creanciers'), { target: { value: 'Veolia' } })
    const chart = screen.getByLabelText("Courbes d'evolution des montants TTC par creancier")
    const input = screen.getByLabelText('Liste de tous les creanciers')
    input.focus()

    await act(async () => {
      if (trigger === 'interval') {
        vi.advanceTimersByTime(15000)
      } else {
        window.dispatchEvent(new Event('focus'))
      }
    })

    expect(mockGetAdminCharges).toHaveBeenCalledTimes(2)
    expect(chart).toBeInTheDocument()
    expect(screen.queryByText('Chargement des factures...')).not.toBeInTheDocument()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('Veolia')
    expect(screen.getByRole('checkbox')).toBeChecked()

    await act(async () => {
      refresh.resolve({ data: [{ ...charge, label: 'Eau actualisee' }], error: null })
    })

    expect(screen.getByLabelText("Courbes d'evolution des montants TTC par creancier")).toBe(chart)
    expect(screen.getByText('Eau actualisee')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('preserves the last invoices on refresh failure and clears the error on recovery', async () => {
    render(<AdminChartsPage />)
    await screen.findByText('Eau')

    mockGetAdminCharges.mockResolvedValueOnce({ data: null, error: 'Reseau indisponible' })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(screen.getByText('Reseau indisponible')).toBeInTheDocument()
    expect(screen.getByText('Eau')).toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.queryByText('Reseau indisponible')).not.toBeInTheDocument()
    expect(screen.getByText('Eau')).toBeInTheDocument()
  })

  it('reports unexpected request failures without leaving the initial loader stuck', async () => {
    mockGetAdminCharges.mockRejectedValueOnce(new Error('Connexion interrompue'))
    render(<AdminChartsPage />)

    expect(await screen.findByText('Connexion interrompue')).toBeInTheDocument()
    expect(screen.queryByText('Chargement des factures...')).not.toBeInTheDocument()
  })

  it('does not overlap refresh requests', async () => {
    vi.useFakeTimers()
    const refresh = pendingCharges()
    render(<AdminChartsPage />)
    await act(async () => {})
    mockGetAdminCharges.mockReturnValueOnce(refresh.promise)

    await act(async () => {
      vi.advanceTimersByTime(15000)
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(15000)
    })
    expect(mockGetAdminCharges).toHaveBeenCalledTimes(2)
    await act(async () => {
      refresh.resolve({ data: [charge], error: null })
    })
  })

  it('ignores responses from a previously selected hall and shows the new hall loader', async () => {
    const previousHall = pendingCharges()
    const nextHall = pendingCharges()
    const { rerender } = render(<AdminChartsPage />)
    await screen.findByText('Eau')
    mockGetAdminCharges.mockReturnValueOnce(previousHall.promise)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-2', loading: false })
    mockGetAdminCharges.mockReturnValueOnce(nextHall.promise)
    rerender(<AdminChartsPage />)
    expect(screen.getByText('Chargement des factures...')).toBeInTheDocument()
    expect(screen.queryByText('Eau')).not.toBeInTheDocument()

    await act(async () => {
      nextHall.resolve({ data: [{ ...charge, label: 'Nouvelle halle' }], error: null })
    })
    await act(async () => {
      previousHall.resolve({ data: [{ ...charge, label: 'Ancienne halle' }], error: null })
    })

    expect(screen.getByText('Nouvelle halle')).toBeInTheDocument()
    expect(screen.queryByText('Ancienne halle')).not.toBeInTheDocument()
    expect(mockGetAdminCharges).toHaveBeenLastCalledWith('hall-2')
  })
})
