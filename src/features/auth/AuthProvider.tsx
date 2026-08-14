import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/domain'

type AuthContextValue = {
  loading: boolean
  user: User | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  configurationError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = getSupabaseClient()
  if (!client) {
    return null
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, email, first_name, last_name, role, merchant_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as Profile
}

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const configurationError = client
    ? null
    : 'Supabase n\'est pas configure. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'

  useEffect(() => {
    if (!client) {
      setLoading(false)
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
      configurationError,
      signIn: async (email, password) => {
        if (!client) {
          return { error: configurationError }
        }

        const { error } = await client.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        if (!client) {
          return
        }

        await client.auth.signOut()
      },
      requestPasswordReset: async (email) => {
        if (!client) {
          return { error: configurationError }
        }

        const { error } = await client.auth.resetPasswordForEmail(email)
        return { error: error?.message ?? null }
      },
    }),
    [client, configurationError, loading, profile, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return ctx
}
