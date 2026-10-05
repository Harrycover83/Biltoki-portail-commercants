import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PennylaneSyncPanel } from './PennylaneSyncPanel'

const { mockUseAdminHall, mockNotifySynced } = vi.hoisted(() => ({
  mockUseAdminHall: vi.fn(),
  mockNotifySynced: vi.fn(),
}))

vi.mock('@/features/admin/AdminHallContext', () => ({
  useAdminHall: mockUseAdminHall,
}))

vi.mock('@/lib/env', () => ({
  getBackendUrl: () => 'https://backend.test',
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
  }),
}))

describe('PennylaneSyncPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUseAdminHall.mockReturnValue({ selectedHallId: 'hall-1', notifySynced: mockNotifySynced })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('runs a full sync for the selected hall and notifies the pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', recordsProcessed: 3, errors: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<PennylaneSyncPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Synchroniser Pennylane' }))

    expect(await screen.findByText(/Synchronisation success : 3 facture\(s\) traitee\(s\)/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.test/api/sync/pennylane/hall-1/backfill',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mockNotifySynced).toHaveBeenCalledTimes(1)
  })
})
