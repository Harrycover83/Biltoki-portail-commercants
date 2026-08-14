import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthProvider'

export function ResetPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await requestPasswordReset(email)
    setStatus(result.error ?? 'Si un compte existe, un email de reinitialisation a ete envoye.')
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Reinitialiser le mot de passe</h1>
        <p className="mt-1 text-sm text-slate-600">Saisissez votre email pour recevoir un lien de reinitialisation.</p>
        {status ? <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{status}</p> : null}
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Envoyer le lien
          </button>
        </form>
        <Link to="/login" className="mt-4 inline-block text-sm text-slate-700 underline">
          Retour connexion
        </Link>
      </div>
    </div>
  )
}
