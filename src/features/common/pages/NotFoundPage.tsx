import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Page introuvable</h1>
        <p className="mt-2 text-slate-600">La page demandee n'existe pas.</p>
        <Link to="/dashboard" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white">
          Retour au dashboard
        </Link>
      </div>
    </div>
  )
}
