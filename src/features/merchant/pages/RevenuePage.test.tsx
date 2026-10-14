import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RevenuePage } from './RevenuePage'
import { parisToday } from '@/features/admin/dashboard/revenue'

const { mockUseAuth, mockGet, mockSave, mockDelete } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(), mockGet: vi.fn(), mockSave: vi.fn(), mockDelete: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: mockUseAuth }))
vi.mock('@/features/merchant/services/merchantRevenueService', () => ({
  getDeclaredRevenue: mockGet, saveDeclaredRevenue: mockSave, deleteDeclaredRevenue: mockDelete,
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, Legend: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

const month = parisToday().slice(0, 7)
const monthLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`))
const label = (value: string) => `CA pour ${monthLabel(value)}`
const saveLabel = (value: string) => `Enregistrer ${monthLabel(value)}`

describe('Merchant revenue declaration', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function setup(declared: [string, number][] = [], merchantId: string | null = 'm1') {
    mockUseAuth.mockReturnValue({ profile: { id: 'u1', role: 'merchant', merchant_id: merchantId, first_name: 'Ana' } })
    mockGet.mockResolvedValue({ data: new Map(declared), error: null })
    mockSave.mockResolvedValue(null)
    mockDelete.mockResolvedValue(null)
  }

  it('starts empty: no hard-coded amounts, nothing declared', async () => {
    setup()
    render(<RevenuePage />)

    expect(await screen.findByText(/Aucun mois déclaré pour le moment/)).toBeTruthy()
    expect((screen.getByLabelText(label(month)) as HTMLInputElement).value).toBe('')
    expect(screen.queryByText(/15\s?382/)).toBeNull()
  })

  it('shows what the merchant declared', async () => {
    setup([[month, 1_234_500]])
    render(<RevenuePage />)

    expect((await screen.findByLabelText(label(month)) as HTMLInputElement).value).toBe('12345')
    expect(screen.queryByText(/Aucun mois déclaré pour le moment/)).toBeNull()
    expect(screen.getByLabelText(/Courbe d'évolution/)).toBeTruthy()
  })

  it('keeps the history of previous years in the curve', async () => {
    setup([['2025-03', 100_000], [month, 50_000]])
    render(<RevenuePage />)

    expect(await screen.findByLabelText(/Courbe d'évolution/)).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith()
  })

  it('saves exact cents for the typed month, then reloads', async () => {
    setup()
    render(<RevenuePage />)
    const input = await screen.findByLabelText(label(month))

    fireEvent.change(input, { target: { value: '1 234,5' } })
    fireEvent.click(screen.getByRole('button', { name: saveLabel(month) }))

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith('m1', month, 123_450))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })

  it('refuses invalid amounts before calling the database', async () => {
    setup()
    render(<RevenuePage />)
    fireEvent.change(await screen.findByLabelText(label(month)), { target: { value: '12,345' } })

    expect(screen.getByText(/Montant invalide/)).toBeTruthy()
    expect((screen.getByRole('button', { name: saveLabel(month) }) as HTMLButtonElement).disabled).toBe(true)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('removes a declaration when the field is emptied', async () => {
    setup([[month, 50_000]])
    render(<RevenuePage />)
    fireEvent.change(await screen.findByLabelText(label(month)), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: saveLabel(month) }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('m1', month))
  })

  it('shows the database error and keeps the typed value', async () => {
    setup()
    mockSave.mockResolvedValue('new row violates row-level security policy')
    render(<RevenuePage />)
    const input = await screen.findByLabelText(label(month)) as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: saveLabel(month) }))

    expect(await screen.findByRole('alert')).toHaveTextContent('row-level security')
    expect(input.value).toBe('100')
  })

  it('explains when the account is not linked to a merchant', () => {
    setup([], null)
    render(<RevenuePage />)

    expect(screen.getByText('Aucun commerce rattaché')).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })
})
