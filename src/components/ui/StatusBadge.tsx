import { clsx } from 'clsx'

type Status = 'draft' | 'calculated' | 'validated' | 'closed'

const statusClassName: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-700',
  calculated: 'bg-blue-100 text-blue-700',
  validated: 'bg-amber-100 text-amber-700',
  closed: 'bg-emerald-100 text-emerald-700',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', statusClassName[status])}>
      {status}
    </span>
  )
}
