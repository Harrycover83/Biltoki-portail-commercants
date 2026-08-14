import { Link } from 'react-router-dom'

export function ChargesPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Frais de service</h1>
      <p className="text-slate-600">Liste des périodes disponibles et accès au détail de calcul transparent.</p>
      <Link className="text-blue-600 underline" to="/frais/demo-period">
        Voir un détail de période
      </Link>
    </section>
  )
}
