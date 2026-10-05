import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ACTION_BUTTON_CLASS } from './styles'

export type Credentials = { email: string; password: string; reason: 'created' | 'reset' }

type CredentialsCardProps = {
  credentials: Credentials
  onClose: () => void
}

/** Shows a provisional password once, right after an account is created or its password reset. */
export function CredentialsCard({ credentials, onClose }: CredentialsCardProps) {
  const [copied, setCopied] = useState(false)

  const copyPassword = async () => {
    await navigator.clipboard?.writeText(credentials.password)
    setCopied(true)
  }

  return (
    <Card
      title={credentials.reason === 'created' ? 'Compte créé' : 'Mot de passe réinitialisé'}
      subtitle={`Transmettez ces identifiants à ${credentials.email}. Le mot de passe provisoire n’est affiché qu’une seule fois ; il devra être changé à la première connexion.`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <code className="bg-[#f7e7b8] px-3 py-2 text-base font-bold tracking-wide text-[#171511]">
          {credentials.password}
        </code>
        <button type="button" className={ACTION_BUTTON_CLASS} onClick={() => void copyPassword()}>
          {copied ? 'Copié' : 'Copier'}
        </button>
        <button type="button" className={ACTION_BUTTON_CLASS} onClick={onClose}>
          J’ai noté le mot de passe, fermer
        </button>
      </div>
    </Card>
  )
}
