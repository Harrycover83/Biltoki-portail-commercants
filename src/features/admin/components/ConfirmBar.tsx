import { ACTION_BUTTON_CLASS } from './styles'

type ConfirmBarProps = {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

/** Inline confirmation for destructive account actions. */
export function ConfirmBar({ message, onConfirm, onCancel }: ConfirmBarProps) {
  return (
    <div role="alertdialog" aria-label="Confirmation" className="border-l-4 border-[#d84d2c] bg-[#fdeee9] px-4 py-3">
      <p className="text-sm font-semibold text-[#171511]">{message}</p>
      <div className="mt-3 flex gap-3">
        <button type="button" className="brand-button" onClick={onConfirm}>
          Confirmer
        </button>
        <button type="button" className={ACTION_BUTTON_CLASS} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  )
}
