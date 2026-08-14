import type { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

type CardProps = PropsWithChildren<{
  className?: string
  title?: string
  subtitle?: string
}>

export function Card({ className, title, subtitle, children }: CardProps) {
  return (
    <section className={clsx('brand-card', className)}>
      {title ? <h3 className="brand-title text-base font-semibold">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-[#5a6270]">{subtitle}</p> : null}
      <div className={clsx(title || subtitle ? 'mt-4' : '')}>{children}</div>
    </section>
  )
}
