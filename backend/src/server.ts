import express from 'express'
import type { SupabaseAdmin } from './db/supabase'
import type { Logger } from './utils/logger'
import { PennylaneSync } from './services/sync.service'
import { syncLock } from './services/sync-lock'
import { PennylaneClient } from './integrations/pennylane/client'
import type { Config } from './config'

export function createServer(config: Config, db: SupabaseAdmin, logger: Logger) {
  const app = express()

  app.use(express.json())

  // Health check
  app.get('/health', (_req, res) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Readiness check: verifies DB is reachable and config is loaded.
  app.get('/ready', async (_req, res) => {
    try {
      const { error } = await db.from('halls').select('id').limit(1)
      if (error) {
        return res.status(503).json({
          status: 'not-ready',
          reason: 'database-check-failed',
          message: error.message,
        })
      }

      return res.json({
        status: 'ready',
        hallsConfigured: config.biltoki.hallsToSync.length,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return res.status(503).json({
        status: 'not-ready',
        reason: 'unexpected-error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Manual sync endpoint for a specific hall
  app.post('/api/sync/pennylane/:hallId', async (req, res) => {
    const { hallId } = req.params

    if (!config.biltoki.hallsToSync.includes(hallId)) {
      return res.status(403).json({
        error: 'Hall not in configured sync list',
        configuredHalls: config.biltoki.hallsToSync,
      })
    }

    logger.info(`📧 Manual sync triggered for hall: ${hallId}`)

    if (syncLock.isRunning(hallId)) {
      return res.status(409).json({
        error: 'Sync already running for this hall',
        hallId,
      })
    }

    try {
      const pennylaneClient = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)
      const result = await syncLock.runExclusive(hallId, async () => {
        const syncService = new PennylaneSync(db, pennylaneClient, hallId, logger)
        return await syncService.syncServiceCharges()
      })

      return res.status(200).json({
        syncId: result.syncId,
        hallId: result.hallId,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        errors: result.errors,
      })
    } catch (error) {
      logger.error('Sync error:', error)
      return res.status(500).json({
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Get sync status
  app.get('/api/sync/pennylane/:syncId', async (req, res) => {
    try {
      const { data, error } = await db
        .from('pennylane_syncs')
        .select('*')
        .eq('id', req.params.syncId)
        .single()

      if (error) {
        return res.status(404).json({ error: 'Sync not found' })
      }

      return res.json(data)
    } catch (error) {
      logger.error('Error fetching sync:', error)
      return res.status(500).json({ error: 'Failed to fetch sync status' })
    }
  })

  // List configured halls
  app.get('/api/halls', (_req, res) => {
    return res.json({
      halls: config.biltoki.hallsToSync,
      count: config.biltoki.hallsToSync.length,
    })
  })

  app.get('/api/sync/locks', (_req, res) => {
    const halls = config.biltoki.hallsToSync.map((hallId) => ({
      hallId,
      running: syncLock.isRunning(hallId),
    }))
    return res.json({
      activeCount: halls.filter((h) => h.running).length,
      halls,
    })
  })

  // 404 handler
  app.use((_req, res) => {
    return res.status(404).json({ error: 'Not found' })
  })

  return app
}
