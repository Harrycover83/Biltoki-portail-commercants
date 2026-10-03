import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '../../../components/layout/AppHeader'
import { AdminDashboardPage } from './AdminDashboardPage'

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }))

vi.mock('../../auth/AuthProvider', () => ({ useAuth: mockUseAuth }))
vi.mock('../AdminHallContext', () => ({
  useAdminHall: () => ({ halls: [], selectedHallId: 'all', setSelectedHallId: vi.fn(), loading: false }),
}))
vi.mock('./PennylaneSyncPanel', () => ({ PennylaneSyncPanel: () => null }))
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

function renderHeader(role: 'admin' | 'merchant') {
  mockUseAuth.mockReturnValue({
    user: { email: 'x@example.com' },
    profile: { role },
    signOut: vi.fn(),
  })
  return render(
    <MemoryRouter initialEntries={['/historique']}>
      <AppHeader />
    </MemoryRouter>,
  )
}

describe('Dashboard tab', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('is the first tab for admins', () => {
    renderHeader('admin')

    const navLabels = screen.getAllByRole('link').map((link) => link.textContent)
    expect(navLabels.indexOf('Dashboard')).toBeGreaterThan(-1)
    expect(navLabels.indexOf('Dashboard')).toBeLessThan(navLabels.indexOf('Charges communes'))
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/admin/dashboard')
  })

  it('is not shown to merchants', () => {
    renderHeader('merchant')

    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull()
    expect(document.querySelector('a[href^="/admin"]')).toBeNull()
  })

  it('renders the preview dashboard', () => {
    render(<AdminDashboardPage />)

    expect(screen.getByText(/données fictives/i)).toBeTruthy()
    expect(screen.getByText('CA du mois')).toBeTruthy()
    expect(screen.getByText('À traiter')).toBeTruthy()
  })
})
