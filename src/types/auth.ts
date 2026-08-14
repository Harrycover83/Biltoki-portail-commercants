export type UserRole = 'merchant' | 'admin'

export type AuthUser = {
  id: string
  email: string
  role: UserRole
}
