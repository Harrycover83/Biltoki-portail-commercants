import { clsx } from 'clsx'

type Status = 'draft' | 'calculated' | 'validated' | 'closed'

const statusClassName: Record<Status, string> = {
  draft: 'bg-[#f1a72d] text-[#15130f]',
  calculated: 'bg-[#df5975] text-[#15130f]',
  validated: 'bg-[#ffe29d] text-[#15130f]',
  closed: 'bg-[#2f8d50] text-white',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx('inline-flex rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide', statusClassName[status])}>
      {status}
    </span>
  )
}
