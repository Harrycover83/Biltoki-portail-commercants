import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** Express 4 ignores rejected promises: forward them to the error-handling middleware instead. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}
