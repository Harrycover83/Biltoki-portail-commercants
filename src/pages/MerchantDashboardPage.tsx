export function MerchantDashboardPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard commerçant</h1>
      <p className="text-slate-600">
        Cette vue est prête pour afficher les données de stand, les mètres linéaires et la synthèse des frais calculés côté serveur.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded border p-4">
          <h2 className="font-medium">Frais de service (période en cours)</h2>
          <p className="mt-2 text-sm text-slate-600">Montant, quote-part et détail de calcul seront alimentés depuis Supabase.</p>
        </article>
        <article className="rounded border p-4">
          <h2 className="font-medium">Stand</h2>
          <p className="mt-2 text-sm text-slate-600">Informations de stand et mètres linéaires historisés par période.</p>
        </article>
      </div>
    </section>
  )
}
