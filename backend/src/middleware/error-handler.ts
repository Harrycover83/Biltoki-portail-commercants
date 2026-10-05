import type { ErrorRequestHandler } from 'express'
import type { Logger } from '../utils/logger.js'

type HttpError = Error & { status?: number; type?: string }

/** Last-resort handler: always answers with JSON and never exposes stack traces. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: HttpError, _req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }

    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large' })
      return
    }

    logger.error({ err: error }, 'Unhandled request error')
    res.status(500).json({ error: 'Internal server error' })
  }
}
