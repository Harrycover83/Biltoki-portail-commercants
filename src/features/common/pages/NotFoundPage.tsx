import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="text-center">
        <h1 className="brand-display text-3xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-[#615b51]">La page demandee n'existe pas.</p>
        <Link to="/historique" className="mt-4 inline-block rounded-md border-2 border-[#15130f] bg-[#d74b27] px-4 py-2 text-sm font-bold text-white">
          Voir l'historique
        </Link>
      </div>
    </div>
  )
}
