type StateMessageVariant = 'loading' | 'empty' | 'error' | 'success'

const variantClassName: Record<StateMessageVariant, string> = {
  loading: 'bg-[#fff9ef] text-[#15130f] border-[#15130f]',
  empty: 'bg-[#f1a72d] text-[#15130f] border-[#15130f]',
  error: 'bg-[#f7d2d8] text-[#15130f] border-[#15130f]',
  success: 'bg-[#a8d8ac] text-[#15130f] border-[#15130f]',
}

type StateMessageProps = {
  variant: StateMessageVariant
  title: string
  message?: string
}

export function StateMessage({ variant, title, message }: StateMessageProps) {
  return (
    <div className={`rounded-md border-2 p-4 text-sm ${variantClassName[variant]}`}>
      <p className="font-semibold">{title}</p>
      {message ? <p className="mt-1">{message}</p> : null}
    </div>
  )
}
