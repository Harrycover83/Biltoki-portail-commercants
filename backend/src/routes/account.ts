import { Router } from 'express'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { requirePortalUser } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/async-handler.js'
import { validatePassword } from '../services/password-policy.js'

/** Routes available to a signed-in account about itself. */
export function createAccountRouter(db: SupabaseAdmin, logger: Logger) {
  const router = Router()

  // Rotates the password and lifts the "provisional password" lock. The lock lives in app_metadata,
  // which only the service role can write, so it cannot be cleared from the browser.
  router.post(
    '/password',
    requirePortalUser(db, logger, { allowPasswordChangePending: true }),
    asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')

      const password = (req.body as { password?: unknown } | undefined)?.password
      const policyError = validatePassword(password)
      if (policyError) {
        return res.status(400).json({ error: policyError })
      }

      const { error } = await db.auth.admin.updateUserById(res.locals.caller as string, {
        password: password as string,
        app_metadata: { ...(res.locals.callerAppMetadata as Record<string, unknown>), must_change_password: false },
      })

      if (error) {
        if (error.status === 422) {
          return res.status(400).json({ error: 'Choisissez un mot de passe différent de l’actuel.' })
        }
        logger.error({ err: error }, 'Password update failed')
        return res.status(500).json({ error: 'Mise à jour impossible pour le moment.' })
      }

      return res.json({ ok: true })
    }),
  )

  return router
}
