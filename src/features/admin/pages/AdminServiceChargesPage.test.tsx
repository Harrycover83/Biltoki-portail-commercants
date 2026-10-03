import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminServiceChargesPage } from './AdminServiceChargesPage'
import type { AdminChargeRow } from '../services/adminChargeService'

const { mockGetAdminCharges, mockUseAdminHall } = vi.hoisted(() => ({
  mockGetAdminCharges: vi.fn(),
  mockUseAdminHall: vi.fn(),
}))

vi.mock('../AdminHallContext', () => ({
  useAdminHall: mockUseAdminHall,
}))

vi.mock('../services/adminChargeService', () => ({
  adminChargeDate: (row: { invoice_date?: string | null }) => row.invoice_date ?? '',
  getAdminCharges: mockGetAdminCharges,
}))

vi.mock('../../../lib/env', () => ({
  getBackendUrl: () => 'https://backend.test',
}))

vi.mock('../../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
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

describe('AdminServiceChargesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-1', loading: false })
    mockGetAdminCharges.mockResolvedValue({ data: [charge], error: null })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the common charges without any sync control in the page body', async () => {
    render(<AdminServiceChargesPage />)

    expect(await screen.findByText('Eau')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Charges communes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Synchroniser/ })).not.toBeInTheDocument()
  })

  it('reloads the charges in the background once a sync completes', async () => {
    const { rerender } = render(<AdminServiceChargesPage />)
    await screen.findByText('Eau')

    mockGetAdminCharges.mockResolvedValue({ data: [{ ...charge, label: 'Eau actualisee' }], error: null })
    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-1', loading: false, syncVersion: 1 })
    rerender(<AdminServiceChargesPage />)

    expect(await screen.findByText('Eau actualisee')).toBeInTheDocument()
    expect(mockGetAdminCharges).toHaveBeenCalledTimes(2)
  })

  it('ignores a response that arrives after the hall changed', async () => {
    let resolveFirst!: (value: { data: AdminChargeRow[]; error: null }) => void
    mockGetAdminCharges.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const { rerender } = render(<AdminServiceChargesPage />)

    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-2', loading: false })
    mockGetAdminCharges.mockResolvedValueOnce({ data: [{ ...charge, label: 'Nouvelle halle' }], error: null })
    rerender(<AdminServiceChargesPage />)
    expect(await screen.findByText('Nouvelle halle')).toBeInTheDocument()

    await act(async () => {
      resolveFirst({ data: [{ ...charge, label: 'Ancienne halle' }], error: null })
    })
    expect(screen.queryByText('Ancienne halle')).not.toBeInTheDocument()
    expect(screen.getByText('Nouvelle halle')).toBeInTheDocument()
  })
})
