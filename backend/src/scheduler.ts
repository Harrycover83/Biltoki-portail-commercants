import cron from 'node-cron'
import type { SupabaseAdmin } from './db/supabase'
import type { Logger } from './utils/logger'
import { PennylaneSync } from './services/sync.service'
import { PennylaneClient } from './integrations/pennylane/client'
import type { Config } from './config'

export function setupScheduler(config: Config, db: SupabaseAdmin, logger: Logger) {
  logger.info(`Scheduling Pennylane sync: ${config.biltoki.syncCronSchedule}`)
  logger.info(`Halls to sync: ${config.biltoki.hallsToSync.join(', ')}`)

  // Validate cron expression
  if (!cron.validate(config.biltoki.syncCronSchedule)) {
    logger.error(`Invalid cron expression: ${config.biltoki.syncCronSchedule}`)
    throw new Error('Invalid cron schedule')
  }

  // Schedule the sync
  const task = cron.schedule(config.biltoki.syncCronSchedule, async () => {
    logger.info(`⏰ Running scheduled Pennylane sync for ${config.biltoki.hallsToSync.length} hall(s)...`)

    const pennylaneClient = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)

    // Sync each hall in sequence
    for (const hallId of config.biltoki.hallsToSync) {
      try {
        logger.info(`Syncing hall: ${hallId}`)
        const syncService = new PennylaneSync(db, pennylaneClient, hallId, logger)
        const result = await syncService.syncServiceCharges()

        if (result.status === 'success') {
          logger.info(`✅ Hall ${hallId}: ${result.recordsProcessed} charges imported`)
        } else {
          logger.error(`❌ Hall ${hallId} sync failed: ${result.errors.join(', ')}`)
        }
      } catch (error) {
        logger.error(`Sync error for hall ${hallId}:`, error)
      }
    }

    logger.info(`✅ All halls synced`)
  })

  logger.info('✅ Scheduler initialized')

  return task
}

export function stopScheduler(task: ReturnType<typeof cron.schedule>) {
  task.stop()
}
