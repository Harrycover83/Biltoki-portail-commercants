import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '../../../components/layout/AppHeader'
import type { UserRole } from '../../../types/domain'
import { AdminDashboardPage } from './AdminDashboardPage'

const { mockUseAuth, mockUseAdminHall } = vi.hoisted(() => ({ mockUseAuth: vi.fn(), mockUseAdminHall: vi.fn() }))

vi.mock('../../auth/AuthProvider', () => ({ useAuth: mockUseAuth }))
vi.mock('../AdminHallContext', () => ({ useAdminHall: mockUseAdminHall }))
vi.mock('./PennylaneSyncPanel', () => ({ PennylaneSyncPanel: () => <button>Synchroniser Pennylane</button> }))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Bar: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
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
  afterEach(cleanup)

  it('renders the preview dashboard', () => {
    render(<AdminDashboardPage />)

    expect(screen.getByText(/données fictives/i)).toBeTruthy()
    expect(screen.getByText('CA du mois')).toBeTruthy()
    expect(screen.getByText('À traiter')).toBeTruthy()
  })
})
