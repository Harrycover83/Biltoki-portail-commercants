import { useState } from 'react'
import { openChargeDocument } from '@/lib/openChargeDocument'

type ChargeDocumentButtonProps = {
  chargeId: string
  onError: (message: string | null) => void
}

export function ChargeDocumentButton({ chargeId, onError }: ChargeDocumentButtonProps) {
  const [opening, setOpening] = useState(false)

  const open = async () => {
    setOpening(true)
    onError(await openChargeDocument(chargeId))
    setOpening(false)
  }

  return (
    <button
      type="button"
      className="rounded border border-[#13223a33] px-2 py-1 text-xs font-semibold text-[#13223a] hover:bg-[#13223a0f] disabled:opacity-50"
      disabled={opening}
      onClick={() => void open()}
    >
      {opening ? 'Ouverture...' : 'Ouvrir'}
    </button>
  )
}
