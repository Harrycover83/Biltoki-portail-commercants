import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/layout/AppHeader'
import type { UserRole } from '@/types/domain'
import { AdminDashboardPage } from './AdminDashboardPage'

const { mockUseAuth, mockUseAdminHall, mockFetchRevenue } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(), mockUseAdminHall: vi.fn(), mockFetchRevenue: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: mockUseAuth }))
vi.mock('@/features/admin/AdminHallContext', () => ({ useAdminHall: mockUseAdminHall }))
vi.mock('@/features/admin/dashboard/revenue', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/admin/dashboard/revenue')>(),
  fetchRevenue: mockFetchRevenue,
}))
vi.mock('@/features/admin/components/PennylaneSyncPanel', () => ({ PennylaneSyncPanel: () => <button>Synchroniser Pennylane</button> }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Bar: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const HALLS = [
  { id: 'h1', name: 'Halle Toulon' },
  { id: 'h2', name: 'Halle Nice' },
]

function renderHeader(role: UserRole, path = '/admin/dashboard', halls = HALLS) {
  mockUseAuth.mockReturnValue({
    user: { email: 'x@example.com' },
    profile: { role, job_title: role === 'hall_manager' ? 'Capitaine' : null },
    signOut: vi.fn(),
  })
  mockUseAdminHall.mockReturnValue({
    halls,
    selectedHallId: halls[0]?.id ?? 'all',
    setSelectedHallId: vi.fn(),
    loading: false,
  })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader />
    </MemoryRouter>,
  )
}

describe('Navigation per role', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it.each(['hall_manager', 'network_manager', 'hq', 'super_admin'] as UserRole[])(
    'shows the Dashboard first for %s',
    (role) => {
      renderHeader(role)

      const navLabels = screen.getAllByRole('link').map((link) => link.textContent)
      expect(navLabels.indexOf('Dashboard')).toBeGreaterThan(-1)
      expect(navLabels.indexOf('Dashboard')).toBeLessThan(navLabels.indexOf('Charges communes'))
      expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/admin/dashboard')
    },
  )

  it('shows the Administration tab to the super admin only', () => {
    renderHeader('super_admin')
    expect(screen.getByRole('link', { name: 'Administration' }).getAttribute('href')).toBe('/admin/administration')
    cleanup()

    for (const role of ['hall_manager', 'network_manager', 'hq'] as UserRole[]) {
      renderHeader(role)
      expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull()
      cleanup()
    }
  })

  it('shows neither Dashboard nor Administration to merchants', () => {
    renderHeader('merchant', '/historique')

    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull()
    expect(document.querySelector('a[href^="/admin"]')).toBeNull()
  })

  it('gives a single-hall manager no hall choice', () => {
    renderHeader('hall_manager', '/admin/dashboard', [HALLS[0]])

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Halle Toulon')).toBeTruthy()
    expect(screen.getByText('Capitaine', { exact: false })).toBeTruthy()
  })

  it('lets multi-hall accounts pick only among their halls', () => {
    renderHeader('network_manager')

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Halle Toulon', 'Halle Nice'])
  })

  it('never shows the Pennylane sync in the header', () => {
    renderHeader('super_admin', '/admin/frais')
    expect(screen.queryByText('Synchroniser Pennylane')).toBeNull()
  })
})

describe('Dashboard page', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function setup() {
    mockUseAdminHall.mockReturnValue({ halls: HALLS, selectedHallId: 'h1', loading: false })
  }

  it('removes all fictional metrics and shows configuration errors explicitly', async () => {
    setup()
    mockFetchRevenue.mockRejectedValue(new Error('Popina non configuré pour cette halle.'))
    render(<AdminDashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Popina non configuré')
    expect(screen.queryByText('84 250 €')).toBeNull()
    expect(screen.queryByText('À traiter')).toBeNull()
    expect(screen.queryByText(/rupture prévue/i)).toBeNull()
    expect(screen.getByText('Suivi non activé')).toBeTruthy()
  })

  const comparison = {
    hallId: 'h1', source: 'Popina', fetchedAt: '2026-10-12T09:00:00Z', since: '2026-10-01', until: '2026-10-11',
    totalCurrentCents: 12000, totalPreviousCents: 10000, comparableDays: 1,
    comparableCurrentCents: 12000, comparablePreviousCents: 10000, trendPercent: 20,
    daily: [{ date: '2026-10-01', previousDate: '2025-10-01', currentCents: 12000, previousCents: 10000 }],
  }

  it('renders real revenue and the N-1 comparison', async () => {
    setup()
    mockFetchRevenue.mockResolvedValue(comparison)
    render(<AdminDashboardPage />)
    expect(await screen.findByText('+20 %')).toBeTruthy()
    expect(screen.getByText('CA N‑1')).toBeTruthy()
    expect(screen.getByText('01/10/2025')).toBeTruthy()
    expect(screen.getAllByText('120,00 €')).toHaveLength(2)
  })

  it('does not invent zero revenue or a trend for missing data', async () => {
    setup()
    mockFetchRevenue.mockResolvedValue({
      ...comparison, totalCurrentCents: null, totalPreviousCents: null,
      comparableDays: 0, comparableCurrentCents: null, comparablePreviousCents: null, trendPercent: null,
      daily: [{ date: '2026-10-01', previousDate: '2025-10-01', currentCents: null, previousCents: null }],
    })
    render(<AdminDashboardPage />)
    expect(await screen.findByText('Non calculable')).toBeTruthy()
    expect(screen.getByText('Aucun rapport de clôture disponible pour cette période.')).toBeTruthy()
    expect(screen.queryByText('0,00 €')).toBeNull()
  })

  it('hides the previous hall revenue immediately when the selection changes', async () => {
    setup()
    mockFetchRevenue.mockResolvedValueOnce(comparison)
    const { rerender } = render(<AdminDashboardPage />)
    expect(await screen.findByText('+20 %')).toBeTruthy()
    mockFetchRevenue.mockImplementation(() => new Promise(() => {}))
    mockUseAdminHall.mockReturnValue({ halls: HALLS, selectedHallId: 'h2', loading: false })
    rerender(<AdminDashboardPage />)
    expect(screen.queryByText('+20 %')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du CA')
  })

  it('rejects an overly long period without fetching it', async () => {
    setup()
    mockFetchRevenue.mockRejectedValue(new Error('Non configuré'))
    render(<AdminDashboardPage />)
    await screen.findByRole('alert')
    const calls = mockFetchRevenue.mock.calls.length
    fireEvent.change(screen.getByLabelText('Début de période'), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText('Fin de période'), { target: { value: '2025-12-31' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Afficher / actualiser' }).closest('form')!)
    expect(screen.getByText('Choisissez une période passée de 1 à 93 jours.')).toBeTruthy()
    expect(mockFetchRevenue).toHaveBeenCalledTimes(calls)
  })
})
