import { Router } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { isStaffRole } from '../auth/roles.js'
import { canReadHall, requirePortalUser } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { isUuid } from '../services/user-input.js'
import { PennylaneClient } from '../integrations/pennylane/client.js'
import {
  countInvoicesToApprove,
  selectProAccount,
  type InvoicesToApprove,
  type ProAccountBalance,
} from '../integrations/pennylane/treasury.js'

type Treasury = {
  source: 'Pennylane'
  fetchedAt: string
  proAccount: ProAccountBalance | null
  invoicesToApprove: InvoicesToApprove
}

/** Walking every supplier invoice is slow and rate-limited, so one result is shared for a short while. */
const CACHE_TTL_MS = 2 * 60_000

/** Only recent invoices can still be waiting for approval; older ones would make every refresh much slower. */
const INVOICE_WINDOW_DAYS = 365

export function createPennylaneRouter(config: Config, db: SupabaseAdmin, logger: Logger) {
  const router = Router()
  router.use(requirePortalUser(db, logger))

  let cached: { at: number; value: Promise<Treasury> } | null = null

  function loadTreasury(refresh: boolean): Promise<Treasury> {
    // A manual refresh still reuses a result younger than 15 s, so repeated clicks cannot hammer Pennylane.
    const maxAge = refresh ? 15_000 : CACHE_TTL_MS
    if (cached && Date.now() - cached.at < maxAge) return cached.value
    const client = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger, config.pennylane.hallCategories)
    const from = new Date(Date.now() - INVOICE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const value = Promise.all([client.listBankAccounts(), client.listAllSupplierInvoices(from)]).then(
      ([accounts, { invoices, truncated }]): Treasury => ({
        source: 'Pennylane',
        fetchedAt: new Date().toISOString(),
        proAccount: selectProAccount(accounts, config.pennylane.proAccountId ?? undefined),
        invoicesToApprove: countInvoicesToApprove(invoices, truncated),
      }),
    )
    cached = { at: Date.now(), value }
    // A failure must not be served from the cache for the next two minutes.
    value.catch(() => { if (cached?.value === value) cached = null })
    return value
  }

  router.get('/:hallId/treasury', asyncHandler(async (req, res) => {
    const { hallId } = req.params
    res.setHeader('Cache-Control', 'private, no-store')
    if (!isStaffRole(res.locals.callerRole)) {
      return res.status(403).json({ error: 'Accès réservé au personnel Biltoki.' })
    }
    if (!isUuid(hallId)) {
      return res.status(400).json({ error: 'Identifiant de halle invalide.' })
    }
    if (!(await canReadHall(db, res.locals.caller, res.locals.callerRole, hallId))) {
      return res.status(403).json({ error: 'Vous ne pouvez pas consulter cette halle.' })
    }
    // The Pennylane token belongs to one company: only halls declared in its mapping may read it.
    if (!config.pennylane.apiKey || !config.pennylane.hallCategories[hallId]) {
      return res.status(503).json({
        code: 'pennylane_not_configured',
        error: 'Pennylane n’est pas encore configuré pour cette halle.',
      })
    }
    try {
      const treasury = await loadTreasury(req.query.refresh === '1')
      return res.json({ hallId, ...treasury })
    } catch (error) {
      logger.error({ err: error }, 'Unable to retrieve Pennylane treasury')
      return res.status(502).json({ error: 'Impossible de récupérer les données Pennylane. Vérifiez la clé et ses droits côté serveur.' })
    }
  }))

  return router
}
