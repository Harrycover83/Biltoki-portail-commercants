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
    <div className="brand-shell grid min-h-screen place-items-center px-4 py-8">
      <div className="brand-card w-full max-w-md p-6 md:p-7">
        <p className="brand-badge">Assistance compte</p>
        <h1 className="brand-title mt-3 text-3xl font-semibold">Reinitialiser le mot de passe</h1>
        <p className="mt-2 text-sm text-[#4d5562]">Saisissez votre email pour recevoir un lien de reinitialisation.</p>
        {status ? <p className="mt-4 rounded-xl border border-[#13223a20] bg-[#13223a0a] p-3 text-sm text-[#2a3242]">{status}</p> : null}
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="brand-input"
          />
          <button type="submit" className="brand-button w-full">
            Envoyer le lien
          </button>
        </form>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-[#13223a] underline underline-offset-2">
          Retour connexion
        </Link>
      </div>
    </div>
  )
}
