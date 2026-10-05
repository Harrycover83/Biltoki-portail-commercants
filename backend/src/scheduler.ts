import cron from 'node-cron'
import type { Config } from './config.js'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'
import { createPennylaneClient, type PennylaneClient } from './integrations/pennylane/client.js'
import { PennylaneSync } from './services/sync.service.js'
import { syncLock } from './services/sync-lock.js'

/** Schedules the Pennylane sync of every configured hall (sequentially, one at a time). */
export function setupScheduler(config: Config, db: SupabaseAdmin, logger: Logger) {
  const { syncCronSchedule, hallsToSync } = config.biltoki

  if (!cron.validate(syncCronSchedule)) {
    throw new Error(`Invalid SYNC_CRON_SCHEDULE: ${syncCronSchedule}`)
  }

  const syncHall = async (pennylane: PennylaneClient, hallId: string) => {
    if (syncLock.isRunning(hallId)) {
      logger.warn(`Skipping hall ${hallId}: sync already running`)
      return
    }

    const result = await syncLock.runExclusive(hallId, () =>
      new PennylaneSync(db, pennylane, hallId, logger).syncServiceCharges(),
    )

    if (result.status === 'success') {
      logger.info(`Hall ${hallId}: ${result.recordsProcessed} charges imported`)
    } else {
      logger.error(`Hall ${hallId} sync failed: ${result.errors.join(', ')}`)
    }
  }

  const task = cron.schedule(syncCronSchedule, async () => {
    logger.info(`Running scheduled Pennylane sync for ${hallsToSync.length} hall(s)`)
    const pennylane = createPennylaneClient(config.pennylane, logger)

    for (const hallId of hallsToSync) {
      try {
        await syncHall(pennylane, hallId)
      } catch (error) {
        logger.error({ err: error }, `Sync error for hall ${hallId}`)
      }
    }
  })

  logger.info(`Scheduler initialized (${syncCronSchedule}) for halls: ${hallsToSync.join(', ')}`)
  return task
}
