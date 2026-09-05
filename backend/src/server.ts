import express from 'express'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'
import { PennylaneSync } from './services/sync.service.js'
import { syncLock } from './services/sync-lock.js'
import { PennylaneClient } from './integrations/pennylane/client.js'
import { requireAdmin, requirePortalUser } from './middleware/auth.js'
import type { Config } from './config.js'

export function createServer(config: Config, db: SupabaseAdmin, logger: Logger) {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  app.use((req, res, next) => {
    const origin = req.header('origin')
    if (origin && config.server.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-internal-token')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }

    return next()
  })

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
        })
      }

      return res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('Readiness check failed:', error)
      return res.status(503).json({
        status: 'not-ready',
        reason: 'unexpected-error',
      })
    }
  })

  app.use('/api/service-charges', requirePortalUser(config, db, logger))

  app.get('/api/service-charges/:chargeId/document', async (req, res) => {
    const { data: charge, error: chargeError } = await db
      .from('service_charges')
      .select('hall_id, pennylane_id')
      .eq('id', req.params.chargeId)
      .maybeSingle()

    if (chargeError) {
      logger.error('Unable to load charge document reference:', chargeError)
      return res.status(500).json({ error: 'Unable to load invoice document' })
    }
    if (!charge?.pennylane_id || !/^\d+$/.test(charge.pennylane_id)) {
      return res.status(404).json({ error: 'No Pennylane document is available for this charge' })
    }

    if (res.locals.callerRole !== 'admin') {
      const { data: merchantAccess, error: merchantAccessError } = await db
        .from('merchant_hall_permissions')
        .select('id')
        .eq('profile_id', res.locals.caller)
        .eq('hall_id', charge.hall_id)
        .maybeSingle()
      const { data: profile } = await db
        .from('profiles')
        .select('merchants!inner(hall_id)')
        .eq('id', res.locals.caller)
        .maybeSingle()
      const merchant = profile?.merchants as { hall_id: string } | { hall_id: string }[] | null
      const merchantHallId = (Array.isArray(merchant) ? merchant[0] : merchant)?.hall_id

      if (merchantAccessError || (!merchantAccess && merchantHallId !== charge.hall_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    try {
      const pennylane = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)
      const invoice = await pennylane.getSupplierInvoice(Number(charge.pennylane_id))
      if (!invoice.public_file_url) {
        return res.status(404).json({ error: 'No source document is attached to this Pennylane invoice' })
      }

      const documentResponse = await fetch(invoice.public_file_url)
      if (!documentResponse.ok) {
        logger.warn(`Pennylane document download failed for invoice ${invoice.id}: ${documentResponse.status}`)
        return res.status(502).json({ error: 'Unable to download the Pennylane document' })
      }

      const contentType = documentResponse.headers.get('content-type')
      const safeContentType = contentType?.startsWith('application/pdf') || contentType?.startsWith('image/')
        ? contentType
        : 'application/octet-stream'
      res.setHeader('Content-Type', safeContentType)
      res.setHeader('Content-Disposition', `inline; filename="pennylane-${invoice.id}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      return res.send(Buffer.from(await documentResponse.arrayBuffer()))
    } catch (error) {
      logger.error('Unable to retrieve Pennylane invoice document:', error)
      return res.status(502).json({ error: 'Unable to retrieve the Pennylane document' })
    }
  })

  app.use('/api', requireAdmin(config, db, logger))

  // Manual sync endpoint for a specific hall
  app.post('/api/sync/pennylane/:hallId', async (req, res) => {
    const { hallId } = req.params

    if (!config.biltoki.hallsToSync.includes(hallId)) {
      return res.status(403).json({
        error: 'Hall not in configured sync list',
        configuredHalls: config.biltoki.hallsToSync,
      })
    }

    logger.info(`📧 Manual sync triggered for hall: ${hallId} by ${res.locals.caller}`)

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
      })
    }
  })

  // One-off full historical import for a hall (all invoices ever categorized, not just recent months)
  app.post('/api/sync/pennylane/:hallId/backfill', async (req, res) => {
    const { hallId } = req.params

    if (!config.biltoki.hallsToSync.includes(hallId)) {
      return res.status(403).json({
        error: 'Hall not in configured sync list',
        configuredHalls: config.biltoki.hallsToSync,
      })
    }

    logger.info(`📦 Full history backfill triggered for hall: ${hallId} by ${res.locals.caller}`)

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
        return await syncService.backfillHistory()
      })

      return res.status(200).json({
        syncId: result.syncId,
        hallId: result.hallId,
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        errors: result.errors,
      })
    } catch (error) {
      logger.error('Backfill error:', error)
      return res.status(500).json({
        error: 'Backfill failed',
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
