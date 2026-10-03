import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdministrationPage } from './AdministrationPage'
import type { ManagedUser } from '../services/adminUsersService'

const { mockService, mockUseAuth } = vi.hoisted(() => ({
  mockService: {
    listUsers: vi.fn(),
    getOptions: vi.fn(),
    listAudit: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setActive: vi.fn(),
    resetPassword: vi.fn(),
    deleteUser: vi.fn(),
  },
  mockUseAuth: vi.fn(),
}))

vi.mock('../services/adminUsersService', async () => {
  const actual = await vi.importActual<typeof import('../services/adminUsersService')>('../services/adminUsersService')
  return { ...actual, adminUsersService: mockService }
})
vi.mock('../../auth/AuthProvider', () => ({ useAuth: mockUseAuth }))

const ME = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'

const users: ManagedUser[] = [
  {
    userId: ME, email: 'boss@biltoki.fr', firstName: 'Alice', lastName: 'Boss', role: 'super_admin',
    jobTitle: null, merchantId: null, hallIds: [], active: true, provisioned: true, lastSignInAt: null,
  },
  {
    userId: OTHER, email: 'cap@biltoki.fr', firstName: 'Bob', lastName: 'Cap', role: 'hall_manager',
    jobTitle: 'Capitaine', merchantId: null, hallIds: ['h1'], active: true, provisioned: true, lastSignInAt: null,
  },
]

describe('AdministrationPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: ME } })
    mockService.listUsers.mockResolvedValue({ data: { users }, error: null })
    mockService.getOptions.mockResolvedValue({
      data: {
        halls: [{ id: 'h1', name: 'Halle Toulon' }, { id: 'h2', name: 'Halle Nice' }],
        merchants: [{ id: 'm1', name: 'Chez Elles', hallId: 'h1' }],
      },
      error: null,
    })
    mockService.listAudit.mockResolvedValue({ data: { entries: [] }, error: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists accounts with their scope and protects the current user', async () => {
    render(<AdministrationPage />)

    expect(await screen.findByText('cap@biltoki.fr')).toBeTruthy()
    expect(screen.getByText('Toutes les halles')).toBeTruthy()
    expect(screen.getByText('Halle Toulon')).toBeTruthy()

    const myRow = screen.getByText('boss@biltoki.fr').closest('tr') as HTMLElement
    expect((within(myRow).getByRole('button', { name: 'Désactiver' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(myRow).getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true)

    const otherRow = screen.getByText('cap@biltoki.fr').closest('tr') as HTMLElement
    expect((within(otherRow).getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('creates an account and shows the provisional password once', async () => {
    mockService.createUser.mockResolvedValue({ data: { userId: 'u3', provisionalPassword: 'Tmp-Pass-123!' }, error: null })
    render(<AdministrationPage />)
    await screen.findByText('cap@biltoki.fr')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un compte' }))

    // Validation: the hall is mandatory for a hall manager.
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Carl' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Dupuis' } })
    fireEvent.change(screen.getByLabelText(/Adresse e-mail/), { target: { value: 'carl@biltoki.fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect((await screen.findByRole('alert')).textContent).toContain('halle')
    expect(mockService.createUser).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Halle'), { target: { value: 'h2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))

    await waitFor(() => expect(mockService.createUser).toHaveBeenCalledTimes(1))
    expect(mockService.createUser.mock.calls[0][0]).toMatchObject({
      email: 'carl@biltoki.fr',
      role: 'hall_manager',
      hallIds: ['h2'],
    })
    expect(await screen.findByText('Tmp-Pass-123!')).toBeTruthy()
  })

  it('offers several halls for a network manager and none for the head office', async () => {
    render(<AdministrationPage />)
    await screen.findByText('cap@biltoki.fr')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un compte' }))

    fireEvent.change(screen.getByLabelText(/^Niveau d’accès/), { target: { value: 'network_manager' } })
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)

    fireEvent.change(screen.getByLabelText(/^Niveau d’accès/), { target: { value: 'hq' } })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText(/aucun périmètre à définir/)).toBeTruthy()
  })

  it('asks for confirmation before deleting', async () => {
    mockService.deleteUser.mockResolvedValue({ data: { ok: true }, error: null })
    render(<AdministrationPage />)
    await screen.findByText('cap@biltoki.fr')

    const row = screen.getByText('cap@biltoki.fr').closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Supprimer' }))
    expect(mockService.deleteUser).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(mockService.deleteUser).toHaveBeenCalledWith(OTHER))
  })

  it('surfaces backend errors', async () => {
    mockService.listUsers.mockResolvedValue({ data: null, error: 'Forbidden' })
    render(<AdministrationPage />)

    expect((await screen.findByRole('alert')).textContent).toContain('Forbidden')
  })
})
