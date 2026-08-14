import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate replace to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} />
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const authError = await login(email, password)
    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">Connexion commerçant</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block text-sm">
          Mot de passe
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button className="w-full rounded bg-slate-900 px-4 py-2 text-white" disabled={submitting} type="submit">
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
