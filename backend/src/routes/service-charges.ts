import { Router } from 'express'
import type { Config } from '../config.js'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { PennylaneClient } from '../integrations/pennylane/client.js'
import { canReadHall, requirePortalUser } from '../middleware/auth.js'
import { fetchDocument } from '../utils/documents.js'

/** Service-charge routes for signed-in portal users. */
export function createServiceChargesRouter(config: Config, db: SupabaseAdmin, logger: Logger) {
  const router = Router()

  router.use(requirePortalUser(config, db, logger))

  // Streams the source document (invoice) of a charge, after checking the caller can see its hall.
  router.get('/:chargeId/document', async (req, res) => {
    const { data: charge, error: chargeError } = await db
      .from('service_charges')
      .select('hall_id, pennylane_id')
      .eq('id', req.params.chargeId)
      .maybeSingle()

    if (chargeError) {
      logger.error({ err: chargeError }, 'Unable to load charge document reference')
      return res.status(500).json({ error: 'Unable to load invoice document' })
    }
    if (!charge?.pennylane_id || !/^\d+$/.test(charge.pennylane_id)) {
      return res.status(404).json({ error: 'No Pennylane document is available for this charge' })
    }

    if (!(await canReadHall(db, res.locals.caller, res.locals.callerRole, charge.hall_id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    try {
      const pennylane = new PennylaneClient(config.pennylane.apiKey, config.pennylane.apiUrl, logger)
      const invoice = await pennylane.getSupplierInvoice(Number(charge.pennylane_id))
      if (!invoice.public_file_url) {
        return res.status(404).json({ error: 'No source document is attached to this Pennylane invoice' })
      }

      const { body, contentType } = await fetchDocument(invoice.public_file_url)
      res.setHeader('Content-Type', contentType)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', `inline; filename="pennylane-${invoice.id}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      return res.send(body)
    } catch (error) {
      logger.error({ err: error }, 'Unable to retrieve Pennylane invoice document')
      return res.status(502).json({ error: 'Unable to retrieve the Pennylane document' })
    }
  })

  return router
}
