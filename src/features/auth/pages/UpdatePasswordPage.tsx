import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../AuthProvider'
import { validatePasswordPolicy } from '../../../lib/passwordPolicy'

export function UpdatePasswordPage() {
  const { user, mustChangePassword, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!mustChangePassword && success) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    const policyError = validatePasswordPolicy(password)
    if (policyError) {
      setError(policyError)
      return
    }

    setSubmitting(true)
    const result = await updatePassword(password)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSuccess('Mot de passe mis a jour. Redirection...')
    setTimeout(() => {
      window.location.assign('/dashboard')
    }, 600)
  }

  return (
    <div className="brand-shell grid min-h-screen place-items-center px-4 py-10">
      <div className="brand-card w-full max-w-md p-7 md:p-8">
        <p className="brand-badge">Securite compte</p>
        <h1 className="brand-display mt-4 text-[2rem] leading-[1] font-semibold">Nouveau mot de passe obligatoire</h1>
        <p className="mt-3 text-sm leading-6 text-[#4d5562]">
          Pour votre premiere connexion, vous devez definir un mot de passe personnel avant d'acceder au portail.
        </p>

        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Nouveau mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="brand-input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">Confirmer le mot de passe</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="brand-input"
            />
          </label>

          <p className="text-xs text-[#626a78]">
            Regles: 12 caracteres minimum, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractere special.
          </p>

          <button
            disabled={submitting}
            type="submit"
            className="brand-button w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Mise a jour...' : 'Mettre a jour mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
