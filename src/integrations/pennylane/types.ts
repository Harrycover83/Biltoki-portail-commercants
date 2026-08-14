export type PennylaneSyncRequest = {
  hallId: string
  periodId: string
}

export type PennylaneSyncResult = {
  recordsProcessed: number
  errors: string[]
}
