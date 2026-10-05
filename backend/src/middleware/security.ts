import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Config } from '../config.js'

/** Caps the request rate per client IP on the authenticated API (each call costs a Supabase lookup). */
export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  })
}

/** Baseline hardening headers for an API that only serves JSON and proxied documents. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
}

/** CORS restricted to the configured portal origins; answers pre-flight requests directly. */
export function cors(config: Config): RequestHandler {
  return (req, res, next) => {
    const origin = req.header('origin')
    if (origin && config.server.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-internal-token')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  }
}
