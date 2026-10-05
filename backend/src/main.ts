import { getConfig } from './config.js'
import { createLogger } from './utils/logger.js'
import { createSupabaseAdmin, verifySupabaseConnection } from './db/supabase.js'
import { createServer } from './server.js'
import { setupScheduler } from './scheduler.js'

async function main() {
  const config = getConfig()
  const logger = createLogger(config)

  logger.info(`Starting Biltoki Pennylane Sync Backend (${config.server.nodeEnv})`)

  const db = createSupabaseAdmin(config, logger)
  if (!(await verifySupabaseConnection(db, logger))) {
    logger.error('Failed to connect to Supabase')
    process.exit(1)
  }

  const app = createServer(config, db, logger)
  const scheduler = setupScheduler(config, db, logger)

  const server = app.listen(config.server.port, () => {
    logger.info(`Server listening on port ${config.server.port}`)
  })

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info(`${signal} received, shutting down gracefully...`)
    scheduler.stop()
    server.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
