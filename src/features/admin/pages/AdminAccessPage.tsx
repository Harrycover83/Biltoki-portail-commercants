import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { StateMessage } from '../../../components/ui/StateMessage'
import { getSupabaseClient } from '../../../lib/supabase'
import type { PortalAccessEntry } from '../../../types/domain'

type MerchantOption = {
  id: string
  label: string
  hallId: string
}

type FormState = {
  email: string
  firstName: string
  lastName: string
  merchantId: string
}

const emptyForm: FormState = { email: '', firstName: '', lastName: '', merchantId: '' }

export function AdminAccessPage() {
  const client = getSupabaseClient()
  const [entries, setEntries] = useState<PortalAccessEntry[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!client) {
      setError('Supabase n\'est pas configure.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [accessResult, merchantResult] = await Promise.all([
      client
        .from('portal_access')
        .select('id, email, first_name, last_name, role, merchant_id, hall_id, active, provisioned_at')
        .order('email'),
      client.from('merchants').select('id, legal_name, trade_name, hall_id').eq('active', true).order('legal_name'),
    ])

    if (accessResult.error) {
      setError(accessResult.error.message)
      setLoading(false)
      return
    }

    setEntries((accessResult.data ?? []) as PortalAccessEntry[])
    setMerchants(
      (merchantResult.data ?? []).map((row) => ({
        id: row.id as string,
        label: (row.trade_name as string | null) ?? (row.legal_name as string),
        hallId: row.hall_id as string,
      })),
    )
    setLoading(false)
  }, [client])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(
    () => ({
      total: entries.length,
      active: entries.filter((entry) => entry.active).length,
      pending: entries.filter((entry) => entry.active && !entry.provisioned_at).length,
    }),
    [entries],
  )

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client) {
      return
    }

    const merchant = merchants.find((option) => option.id === form.merchantId)
    if (!merchant) {
      setError('Selectionnez le commercant locataire du stand.')
      return
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)

    const { error: insertError } = await client.from('portal_access').insert({
      email: form.email.trim().toLowerCase(),
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      role: 'merchant',
      merchant_id: merchant.id,
      hall_id: merchant.hallId,
      active: true,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(emptyForm)
    setNotice('Email ajoute a la liste. Lancez la provision des comptes pour creer l\'acces.')
    await load()
  }

  const toggleActive = async (entry: PortalAccessEntry) => {
    if (!client) {
      return
    }

    const { error: updateError } = await client
      .from('portal_access')
      .update({ active: !entry.active })
      .eq('id', entry.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(
      entry.active
        ? 'Acces desactive. Relancez la provision pour bloquer le compte Supabase.'
        : 'Acces reactive. Relancez la provision pour debloquer le compte.',
    )
    await load()
  }

  return (
    <PageContainer>
      <Card
        title="Acces au portail"
        subtitle="Seuls les emails listes ici peuvent obtenir un compte. Chaque compte recoit un mot de passe provisoire unique, a changer obligatoirement a la premiere connexion."
      >
        {error ? <StateMessage variant="error" title="Erreur" message={error} /> : null}
        {notice ? <StateMessage variant="success" title="Enregistre" message={notice} /> : null}

        <form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="email@locataire.fr"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="brand-input md:col-span-2"
          />
          <input
            type="text"
            placeholder="Prenom"
            value={form.firstName}
            onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            className="brand-input"
          />
          <input
            type="text"
            placeholder="Nom"
            value={form.lastName}
            onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            className="brand-input"
          />
          <select
            required
            value={form.merchantId}
            onChange={(event) => setForm((prev) => ({ ...prev, merchantId: event.target.value }))}
            className="brand-input"
          >
            <option value="">Commercant...</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={submitting} className="brand-button md:col-span-5">
            {submitting ? 'Ajout...' : 'Ajouter a la liste'}
          </button>
        </form>
      </Card>

      <Card
        className="mt-6"
        title={`Locataires autorises (${stats.active}/${stats.total})`}
        subtitle={stats.pending > 0 ? `${stats.pending} compte(s) en attente de provision.` : undefined}
      >
        {loading ? (
          <StateMessage variant="loading" title="Chargement..." />
        ) : entries.length === 0 ? (
          <StateMessage variant="empty" title="Aucun email autorise" message="Ajoutez les locataires de stands ci-dessus." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#5a6270]">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Compte</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#13223a14]">
                    <td className="py-2 pr-3">{entry.email}</td>
                    <td className="py-2 pr-3">
                      {[entry.first_name, entry.last_name].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="py-2 pr-3">{entry.role}</td>
                    <td className="py-2 pr-3">{entry.provisioned_at ? 'Cree' : 'En attente'}</td>
                    <td className="py-2 pr-3">{entry.active ? 'Actif' : 'Revoque'}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleActive(entry)}
                        className="text-sm font-medium text-[#13223a] underline underline-offset-2"
                      >
                        {entry.active ? 'Desactiver' : 'Reactiver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  )
}
