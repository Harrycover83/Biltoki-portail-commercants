import { Card } from '@/components/ui/Card'
import type { AuditEntry } from '@/features/admin/services/adminUsersService'
import { formatDateTime } from '@/lib/format'

const AUDIT_LABELS: Record<string, string> = {
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.activate': 'Compte réactivé',
  'user.deactivate': 'Compte désactivé',
  'user.reset_password': 'Mot de passe réinitialisé',
  'user.delete': 'Compte supprimé',
}

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card title="Journal des modifications" subtitle="Les 50 dernières actions d’administration.">
      {entries.length === 0 ? (
        <p className="text-sm text-[#615b51]">Aucune action enregistrée.</p>
      ) : (
        <ul className="divide-y divide-[#e4ddd1] text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <strong>{AUDIT_LABELS[entry.action] ?? entry.action}</strong> · {entry.target_email ?? '—'}
              </span>
              <span className="text-xs text-[#615b51]">
                {entry.actor_email ?? 'système'} · {formatDateTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
