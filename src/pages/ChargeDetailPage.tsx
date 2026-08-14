import { useParams } from 'react-router-dom'

export function ChargeDetailPage() {
  const { periodId } = useParams()

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Détail des frais</h1>
      <p className="text-slate-600">Période: {periodId}</p>
      <p className="text-sm text-slate-600">
        Le calcul affiché doit provenir des données historisées (snapshot) de la période clôturée.
      </p>
    </section>
  )
}
