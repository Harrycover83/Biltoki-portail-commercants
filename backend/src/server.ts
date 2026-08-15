import express from 'express'
import type { SupabaseAdmin } from './db/supabase'
import type { Logger } from './utils/logger'
import { PennylaneSync } from './services/sync.service'
import { PennylaneClient } from './integrations/pennylane/client'
import type { Config } from './config'

export function createServer(config: Config, db: SupabaseAdmin, logger: Logger) {
  const app = express()

  app.use(express.json())

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

    try {
      const pennylaneClient = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)
      const syncService = new PennylaneSync(db, pennylaneClient, hallId, logger)

      const result = await syncService.syncServiceCharges()

      res.status(200).json({
        syncId: result.syncId,
        hallId: result.hallId,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        errors: result.errors,
      })
    } catch (error) {
      logger.error('Sync error:', error)
      res.status(500).json({
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

      res.json(data)
    } catch (error) {
      logger.error('Error fetching sync:', error)
      res.status(500).json({ error: 'Failed to fetch sync status' })
    }
  })

  // List configured halls
  app.get('/api/halls', (req, res) => {
    res.json({
      halls: config.biltoki.hallsToSync,
      count: config.biltoki.hallsToSync.length,
    })
  })

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}
