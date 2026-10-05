import { Router, type Request, type Response } from 'express'
import type { SupabaseAdmin } from '../db/supabase.js'
import type { Logger } from '../utils/logger.js'
import { UserAdminError, UserAdminService, type Actor } from '../services/users.service.js'
import { isUuid, validateUserInput } from '../services/user-input.js'

function actorOf(res: Response): Actor {
  return {
    id: typeof res.locals.caller === 'string' ? res.locals.caller : null,
    email: typeof res.locals.callerEmail === 'string' ? res.locals.callerEmail : null,
  }
}

/** Account administration routes. Must be mounted behind requireSuperAdminUser. */
export function createAdminUsersRouter(db: SupabaseAdmin, logger: Logger) {
  const router = Router()
  const service = new UserAdminService(db, logger)

  const handle =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response): Promise<void> => {
      try {
        await fn(req, res)
      } catch (error) {
        if (error instanceof UserAdminError) {
          res.status(error.status).json({ error: error.message })
          return
        }
        logger.error({ err: error }, 'Admin users route failed')
        res.status(500).json({ error: 'Operation impossible pour le moment.' })
      }
    }

  const userIdOf = (value: string, res: Response): string | null => {
    if (!isUuid(value)) {
      res.status(400).json({ error: 'Identifiant invalide.' })
      return null
    }
    return value
  }

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  router.get(
    '/users',
    handle(async (_req, res) => res.json({ users: await service.listUsers() })),
  )

  router.get(
    '/options',
    handle(async (_req, res) => res.json(await service.getOptions())),
  )

  router.get(
    '/audit',
    handle(async (_req, res) => res.json({ entries: await service.listAudit(50) })),
  )

  router.post(
    '/users',
    handle(async (req, res) => {
      const parsed = validateUserInput(req.body, { requireEmail: true })
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error })
      }
      const created = await service.createUser(parsed.value, actorOf(res))
      return res.status(201).json(created)
    }),
  )

  router.patch(
    '/users/:userId',
    handle(async (req, res) => {
      const userId = userIdOf(req.params.userId, res)
      if (!userId) {
        return
      }
      const parsed = validateUserInput(req.body, { requireEmail: false })
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error })
      }
      const { firstName, lastName, role, jobTitle, merchantId, hallIds } = parsed.value
      await service.updateUser(userId, { firstName, lastName, role, jobTitle, merchantId, hallIds }, actorOf(res))
      return res.json({ ok: true })
    }),
  )

  router.post(
    '/users/:userId/deactivate',
    handle(async (req, res) => {
      const userId = userIdOf(req.params.userId, res)
      if (!userId) {
        return
      }
      await service.setActive(userId, false, actorOf(res))
      return res.json({ ok: true })
    }),
  )

  router.post(
    '/users/:userId/activate',
    handle(async (req, res) => {
      const userId = userIdOf(req.params.userId, res)
      if (!userId) {
        return
      }
      await service.setActive(userId, true, actorOf(res))
      return res.json({ ok: true })
    }),
  )

  router.post(
    '/users/:userId/reset-password',
    handle(async (req, res) => {
      const userId = userIdOf(req.params.userId, res)
      if (!userId) {
        return
      }
      return res.json(await service.resetPassword(userId, actorOf(res)))
    }),
  )

  router.delete(
    '/users/:userId',
    handle(async (req, res) => {
      const userId = userIdOf(req.params.userId, res)
      if (!userId) {
        return
      }
      await service.deleteUser(userId, actorOf(res))
      return res.json({ ok: true })
    }),
  )

  return router
}
