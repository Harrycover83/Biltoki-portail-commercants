import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase'
import { getBackendUrl } from '@/lib/env'
import { getAccessToken } from '@/lib/session'
import type { Profile, UserRole } from '@/types/domain'

const ACCESS_DENIED_MESSAGE =
  "Cet email n'est pas autorisé à accéder au portail. Contactez le gestionnaire de la halle."

type AuthContextValue = {
  loading: boolean
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  mustChangePassword: boolean
  configurationError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Belt and braces: accounts only exist for allowlisted tenants, but this also
// locks out anyone whose entry was deactivated while holding a live session.
async function isEmailAllowed(email: string | undefined): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client || !email) {
    return false
  }

  const { data, error } = await client
    .from('portal_access')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('active', true)
    .maybeSingle()

  return !error && Boolean(data)
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = getSupabaseClient()
  if (!client) {
    return null
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, email, first_name, last_name, role, job_title, merchant_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as Profile
}

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient()

  const [loading, setLoading] = useState(client !== null)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const mustChangePassword = user?.app_metadata?.must_change_password === true

  const configurationError = client
    ? null
    : 'Supabase n\'est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'

  useEffect(() => {
    if (!client) {
      return
    }

    let mounted = true

    const init = async () => {
      const {
        data: { session: currentSession },
      } = await client.auth.getSession()

      if (!mounted) {
        return
      }

      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      if (currentSession?.user) {
        const loadedProfile = await fetchProfile(currentSession.user.id)
        if (mounted) {
          setProfile(loadedProfile)
        }
      }

      setLoading(false)
    }

    void init()

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession?.user) {
        setProfile(null)
        return
      }

      void fetchProfile(nextSession.user.id).then((loadedProfile) => {
        setProfile(loadedProfile)
      })
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      session,
      profile,
      role: profile?.role ?? null,
      mustChangePassword,
      configurationError,
      signIn: async (email, password) => {
        if (!client) {
          return { error: configurationError }
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password })
        if (error) {
          return { error: error.message }
        }

        const allowed = await isEmailAllowed(data.user?.email)
        if (!allowed) {
          await client.auth.signOut()
          return { error: ACCESS_DENIED_MESSAGE }
        }

        return { error: null }
      },
      signOut: async () => {
        if (!client) {
          return
        }

        await client.auth.signOut()
      },
      updatePassword: async (newPassword) => {
        const backendUrl = getBackendUrl()
        const token = await getAccessToken()
        if (!client || !user || !backendUrl || !token) {
          return { error: configurationError ?? 'Session invalide.' }
        }

        // The backend enforces the password policy and lifts the forced-change lock, which only the
        // server can write (app_metadata).
        try {
          const response = await fetch(`${backendUrl}/api/account/password`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword }),
          })
          const body = (await response.json().catch(() => ({}))) as { error?: string }
          if (!response.ok) {
            return { error: body.error ?? `Mise à jour impossible (HTTP ${response.status}).` }
          }
        } catch {
          return { error: 'Service indisponible, réessayez dans un instant.' }
        }

        // Fetch a token that no longer carries the lock.
        const { error } = await client.auth.refreshSession()
        return { error: error?.message ?? null }
      },
    }),
    [client, configurationError, loading, mustChangePassword, profile, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return ctx
}
