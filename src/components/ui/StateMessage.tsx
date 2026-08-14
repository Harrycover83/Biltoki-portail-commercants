type StateMessageVariant = 'loading' | 'empty' | 'error' | 'success'

const variantClassName: Record<StateMessageVariant, string> = {
  loading: 'bg-slate-100 text-slate-700 border-slate-200',
  empty: 'bg-blue-50 text-blue-800 border-blue-200',
  error: 'bg-rose-50 text-rose-800 border-rose-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

type StateMessageProps = {
  variant: StateMessageVariant
  title: string
  message?: string
}

export function StateMessage({ variant, title, message }: StateMessageProps) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${variantClassName[variant]}`}>
      <p className="font-semibold">{title}</p>
      {message ? <p className="mt-1">{message}</p> : null}
    </div>
  )
}
