import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { getRuntimeConfig } from '../../../lib/env'

export function LoginPage() {
  const { user, signIn, configurationError } = useAuth()
  const location = useLocation()
  const config = getRuntimeConfig()

  let supabaseHost: string | null = null
  if (config.supabaseUrl) {
    try {
      supabaseHost = new URL(config.supabaseUrl).host
    } catch {
      supabaseHost = config.supabaseUrl
    }
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | undefined)?.from ?? '/dashboard'
    return <Navigate to={from} replace />
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
    }

    setSubmitting(false)
  }

  return (
    <div className="brand-shell grid min-h-screen place-items-center px-4 py-10">
      <div className="brand-card w-full max-w-md p-7 md:p-8">
        <p className="brand-badge">Portail Biltoki</p>
        <h1 className="brand-display mt-4 text-[2.3rem] leading-[0.98] font-semibold">Connexion commercant</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#4d5562]">
          Accedez a votre espace personnel des Halles de Biltoki.
        </p>

        {configurationError ? <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">{configurationError}</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="brand-input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="brand-input"
            />
          </label>
          <button
            disabled={submitting}
            type="submit"
            className="brand-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <Link to="/reset-password" className="mt-5 inline-block text-sm font-medium text-[#13223a] underline underline-offset-2">
          Mot de passe oublie ?
        </Link>

        {supabaseHost ? (
          <p className="mt-3 text-xs text-[#626a78]">Projet Supabase detecte: {supabaseHost}</p>
        ) : null}
      </div>
    </div>
  )
}
