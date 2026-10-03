import type { PennylaneSyncRequest, PennylaneSyncResult } from './types'

export async function syncPennylaneServiceCharges(input: PennylaneSyncRequest): Promise<PennylaneSyncResult> {
  void input
  throw new Error(
    'Sync workflow is scaffolded but blocked until Pennylane official endpoints and accounting mapping rules are validated.',
  )
}
