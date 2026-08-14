import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../supabase/client'
import type { AuthUser, UserRole } from '../types/auth'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapRole(roleValue: unknown): UserRole {
  return roleValue === 'admin' ? 'admin' : 'merchant'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const client = supabase

    if (!client) {
      setLoading(false)
      return
    }

    const hydrate = async () => {
      const {
        data: { user: authUser },
      } = await client.auth.getUser()

      if (authUser?.email) {
        setUser({
          id: authUser.id,
          email: authUser.email,
          role: mapRole(authUser.app_metadata?.role),
        })
      }

      setLoading(false)
    }

    hydrate().catch(() => setLoading(false))

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.email) {
        setUser(null)
        return
      }

      setUser({
        id: session.user.id,
        email: session.user.email,
        role: mapRole(session.user.app_metadata?.role),
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email: string, password: string) => {
        if (!supabase) {
          return 'Supabase non configuré. Vérifiez vos variables d\'environnement.'
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error?.message ?? null
      },
      logout: async () => {
        if (!supabase) {
          return
        }

        await supabase.auth.signOut()
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider')
  }

  return context
}
