import { getConfig } from './config'
import { createLogger } from './utils/logger'
import { createSupabaseAdmin, verifySupabaseConnection } from './db/supabase'
import { createServer } from './server'
import { setupScheduler } from './scheduler'

async function main() {
  try {
    // Load config
    const config = getConfig()
    const logger = createLogger(config)

    logger.info('🚀 Starting Biltoki Pennylane Sync Backend')
    logger.info(`Environment: ${config.server.nodeEnv}`)

    // Initialize Supabase
    const db = createSupabaseAdmin(config, logger)
    const connected = await verifySupabaseConnection(db, logger)
    if (!connected) {
      logger.error('Failed to connect to Supabase')
      process.exit(1)
    }

    // Create Express server
    const app = createServer(config, db, logger)

    // Setup scheduler
    const scheduler = setupScheduler(config, db, logger)

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info(`✅ Server listening on port ${config.server.port}`)
      logger.info(`📧 Sync endpoint: POST http://localhost:${config.server.port}/api/sync/pennylane`)
      logger.info(`❤️  Health check: GET http://localhost:${config.server.port}/health`)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...')
      scheduler.stop()
      server.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...')
      scheduler.stop()
      server.close(() => {
        logger.info('Server closed')
        process.exit(0)
      })
    })
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
