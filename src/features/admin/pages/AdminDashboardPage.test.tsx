import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/components/layout/AppHeader'
import type { UserRole } from '@/types/domain'
import { AdminDashboardPage } from './AdminDashboardPage'
import { parisYesterday } from '@/features/admin/dashboard/revenue'
import { addDays, sameWeekLastYear, weekStart, weekdayIndex } from '@/features/admin/dashboard/weeks'

const { mockUseAuth, mockUseAdminHall, mockFetchDaily } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(), mockUseAdminHall: vi.fn(), mockFetchDaily: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: mockUseAuth }))
vi.mock('@/features/admin/AdminHallContext', () => ({ useAdminHall: mockUseAdminHall }))
vi.mock('@/features/admin/dashboard/revenue', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/admin/dashboard/revenue')>(),
  fetchDailyRevenue: mockFetchDaily,
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

  it('words the hall bar after the profile', () => {
    renderHeader('hall_manager', '/admin/dashboard', [HALLS[0]])
    expect(screen.getByText('Ma halle')).toBeTruthy()
    cleanup()

    renderHeader('network_manager')
    expect(screen.getByText('Mes halles')).toBeTruthy()
    cleanup()

    renderHeader('hq')
    expect(screen.getByText('Halle observée')).toBeTruthy()
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
    mockUseAuth.mockReturnValue({ profile: { id: 'u1', role: 'hall_manager' } })
    mockUseAdminHall.mockReturnValue({ halls: HALLS, selectedHallId: 'h1', loading: false })
  }

  const lastDate = parisYesterday()

  /** Fake Popina backend: answers every requested range from a date → cents function. */
  function backend(values: (date: string) => number | null) {
    mockFetchDaily.mockImplementation(async (hallId: string, since: string, until: string) => ({
      hallId, source: 'Popina', fetchedAt: '2026-10-12T09:00:00Z', since, until,
      days: Array.from({ length: Math.round((Date.parse(until) - Date.parse(since)) / 86_400_000) + 1 }, (_, index) => {
        const date = addDays(since, index)
        return { date, cents: values(date) }
      }),
    }))
  }

  const weekdayLastYear = (date: string) => addDays(sameWeekLastYear(weekStart(date)), weekdayIndex(date))
  const weekdayLastWeek = (date: string) => addDays(date, -7)

  it('shows no fictional metrics and surfaces configuration errors explicitly', async () => {
    setup()
    mockFetchDaily.mockRejectedValue(new Error('Popina non configuré pour cette halle.'))
    render(<AdminDashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Popina non configuré')
    expect(screen.queryByText('84 250 €')).toBeNull()
    expect(screen.queryByText('À traiter')).toBeNull()
    expect(screen.getByText('Suivi non activé')).toBeTruthy()
  })

  it('shows yesterday’s revenue in a compact card, with no daily table', async () => {
    setup()
    backend((date) => (date === lastDate ? 12000 : date === weekdayLastYear(lastDate) ? 10000 : date === weekdayLastWeek(lastDate) ? 8000 : null))
    render(<AdminDashboardPage />)

    expect(await screen.findByText('+20 %')).toBeTruthy()
    expect(screen.getByText('CA de la veille')).toBeTruthy()
    expect(screen.getByText('120,00 €')).toBeTruthy()
    expect(screen.getByText('+50 %')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByLabelText('Date observée')).toBeNull()
  })

  it('does not invent zero revenue or a trend for missing data', async () => {
    setup()
    backend(() => null)
    render(<AdminDashboardPage />)

    expect(await screen.findAllByText('Non calculable')).toHaveLength(2)
    expect(screen.getAllByText('Données non remontées')).toHaveLength(3)
    expect(screen.queryByText('0,00 €')).toBeNull()
  })

  it('labels a missing Monday as closed in Toulon only', async () => {
    const toulon = '29a1b758-07c9-481e-bd54-c72b6a9949c4'
    const monday = addDays(weekStart(lastDate), -7)
    mockUseAuth.mockReturnValue({ profile: { id: 'u1', role: 'hall_manager' } })
    mockUseAdminHall.mockReturnValue({ halls: [{ id: toulon, name: 'Halle Toulon' }], selectedHallId: toulon, loading: false })
    backend(() => null)
    render(<AdminDashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /CA de la veille/ }))
    fireEvent.change(screen.getByLabelText('Date observée'), { target: { value: monday } })
    expect(await screen.findAllByText('Fermé · lundi')).toHaveLength(3)
    cleanup()

    setup()
    render(<AdminDashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /CA de la veille/ }))
    fireEvent.change(screen.getByLabelText('Date observée'), { target: { value: monday } })
    await screen.findAllByText('Données non remontées')
    expect(screen.queryByText('Fermé · lundi')).toBeNull()
  })

  it('compares a calendar week with the same week last year and the previous week', async () => {
    setup()
    const monday = addDays(weekStart(lastDate), -7)
    const inWeek = (date: string, start: string) => date >= start && date <= addDays(start, 6)
    backend((date) => (inWeek(date, monday) ? 1000 : inWeek(date, sameWeekLastYear(monday)) ? 500 : inWeek(date, addDays(monday, -7)) ? 800 : null))
    render(<AdminDashboardPage />)
    fireEvent.click(screen.getByRole('button', { name: /CA de la veille/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    fireEvent.change(screen.getByLabelText('Date observée'), { target: { value: monday } })

    expect(await screen.findByText('+100 %')).toBeTruthy()
    expect(screen.getByText('+25 %')).toBeTruthy()
    expect(screen.getByText('70,00 €')).toBeTruthy()
    expect(screen.getByText(/^CA de la semaine \d+ ·/)).toBeTruthy()
  })

  it('hides the previous hall revenue immediately when the selection changes', async () => {
    setup()
    backend((date) => (date === lastDate ? 12000 : null))
    const { rerender } = render(<AdminDashboardPage />)
    expect(await screen.findByText('120,00 €')).toBeTruthy()
    mockFetchDaily.mockImplementation(() => new Promise(() => {}))
    mockUseAdminHall.mockReturnValue({ halls: HALLS, selectedHallId: 'h2', loading: false })
    rerender(<AdminDashboardPage />)
    expect(screen.queryByText('120,00 €')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Chargement du CA')
  })

  it('removes a widget with its cross', () => {
    window.localStorage.clear()
    setup()
    mockFetchDaily.mockReturnValue(new Promise(() => {}))
    render(<AdminDashboardPage />)
    expect(screen.getByText('Suivi non activé')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Stock' }))
    expect(screen.queryByText('Suivi non activé')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Stock' })).toBeNull()
    window.localStorage.clear()
  })

  it('moves a widget with the keyboard or by drag and drop', () => {
    window.localStorage.clear()
    setup()
    mockFetchDaily.mockReturnValue(new Promise(() => {}))
    render(<AdminDashboardPage />)
    const order = () => screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(order()).toEqual(['Chiffre d’affaires', 'RH', 'Finances', 'Stock', 'Organisation'])

    fireEvent.keyDown(screen.getByRole('button', { name: 'Déplacer RH' }), { key: 'ArrowDown' })
    expect(order()).toEqual(['Chiffre d’affaires', 'Finances', 'RH', 'Stock', 'Organisation'])

    fireEvent.dragStart(screen.getByRole('button', { name: 'Déplacer Organisation' }))
    fireEvent.drop(screen.getByRole('region', { name: 'Chiffre d’affaires' }))
    expect(order()).toEqual(['Organisation', 'Chiffre d’affaires', 'Finances', 'RH', 'Stock'])
    window.localStorage.clear()
  })

  it('lets the user choose and reorder the widgets from the settings gear', () => {
    window.localStorage.clear()
    setup()
    mockFetchDaily.mockReturnValue(new Promise(() => {}))
    render(<AdminDashboardPage />)
    expect(screen.getByText('Suivi non activé')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le dashboard' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Stock/ }))
    expect(screen.queryByText('Suivi non activé')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Descendre RH' }))
    const titles = screen.getAllByRole('checkbox').map((box) => box.id)
    expect(titles.indexOf('widget-finance')).toBeLessThan(titles.indexOf('widget-hr'))
    window.localStorage.clear()
  })
})
