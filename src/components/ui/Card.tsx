import type { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

type CardProps = PropsWithChildren<{
  className?: string
  title?: string
  subtitle?: string
}>

export function Card({ className, title, subtitle, children }: CardProps) {
  return (
    <section className={clsx('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      {title ? <h3 className="text-base font-semibold text-slate-900">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className={clsx(title || subtitle ? 'mt-4' : '')}>{children}</div>
    </section>
  )
}
