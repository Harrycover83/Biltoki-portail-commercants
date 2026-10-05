import express from 'express'
import type { Config } from './config.js'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'
import { requireSuperAdmin, requireSuperAdminUser } from './middleware/auth.js'
import { errorHandler } from './middleware/error-handler.js'
import { apiRateLimit, cors, securityHeaders } from './middleware/security.js'
import { createAccountRouter } from './routes/account.js'
import { createAdminUsersRouter } from './routes/admin-users.js'
import { createHealthRouter } from './routes/health.js'
import { createServiceChargesRouter } from './routes/service-charges.js'
import { createHallSyncRouter, createSyncOperationsRouter } from './routes/sync.js'

export function createServer(config: Config, db: SupabaseAdmin, logger: Logger) {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', config.server.trustProxyHops)
  app.use(securityHeaders)
  app.use(express.json({ limit: '100kb' }))
  app.use(cors(config))

  app.use(createHealthRouter(db, logger))

  app.use('/api', apiRateLimit())
  app.use('/api/service-charges', createServiceChargesRouter(config, db, logger))

  // Account self-service (password rotation)
  app.use('/api/account', createAccountRouter(db, logger))

  // Account administration (signed-in super_admin only)
  app.use('/api/admin', requireSuperAdminUser(config, db, logger), createAdminUsersRouter(db, logger))

  // Pennylane syncs: staff accounts limited to their halls (or the ops token)
  app.use('/api/sync/pennylane', createHallSyncRouter(config, db, logger))

  // Everything below is reserved to the super_admin (or the ops token)
  app.use('/api', requireSuperAdmin(config, db, logger), createSyncOperationsRouter(config, db, logger))

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use(errorHandler(logger))

  return app
}
