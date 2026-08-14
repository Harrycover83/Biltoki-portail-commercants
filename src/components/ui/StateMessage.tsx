type StateMessageVariant = 'loading' | 'empty' | 'error' | 'success'

const variantClassName: Record<StateMessageVariant, string> = {
  loading: 'bg-[#13223a0d] text-[#2a3242] border-[#13223a24]',
  empty: 'bg-[#f3b54d22] text-[#3a2f1e] border-[#f3b54d66]',
  error: 'bg-rose-50 text-rose-800 border-rose-200',
  success: 'bg-[#4f7a4f1a] text-[#244224] border-[#4f7a4f55]',
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
