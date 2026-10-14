import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
  onDragStart: () => void
  onDropHere: () => void
}

const MOVE_KEYS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }

/** A dashboard element with its controls: a handle to move it (drag or arrow keys) and a cross to remove it. */
export function DashboardWidgetFrame({ title, subtitle, children, onRemove, onMove, onDragStart, onDropHere }: Props) {
  const frame = useRef<HTMLElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleKeyDown(event: KeyboardEvent) {
    const direction = MOVE_KEYS[event.key]
    if (!direction) return
    event.preventDefault()
    onMove(direction)
  }

  return (
    <section
      ref={frame}
      aria-label={title}
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        onDropHere()
      }}
      className={`brand-card h-full ${dragOver ? 'outline outline-2 outline-[#d84d2c]' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="brand-title text-base font-semibold">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#615b51]">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[#615b51]">
          <span
            role="button"
            tabIndex={0}
            draggable
            aria-label={`Déplacer ${title}`}
            title="Glisser pour déplacer (ou flèches du clavier)"
            onKeyDown={handleKeyDown}
            onDragStart={(event) => {
              onDragStart()
              event.dataTransfer?.setData('text/plain', title)
              if (frame.current) event.dataTransfer?.setDragImage?.(frame.current, 16, 16)
            }}
            className="cursor-grab select-none px-1 leading-none hover:text-[#171511]"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
            </svg>
          </span>
          <button
            type="button"
            aria-label={`Retirer ${title}`}
            title="Retirer du dashboard"
            onClick={onRemove}
            className="px-1 text-lg leading-none hover:text-[#d84d2c]"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  )
}
