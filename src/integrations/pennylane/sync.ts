import type { PennylaneSyncRequest, PennylaneSyncResult } from './types'

export async function syncPennylaneServiceCharges(_input: PennylaneSyncRequest): Promise<PennylaneSyncResult> {
  throw new Error(
    'Sync workflow is scaffolded but blocked until Pennylane official endpoints and accounting mapping rules are validated.',
  )
}
