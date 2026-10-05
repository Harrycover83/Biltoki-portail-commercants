import dotenv from 'dotenv'

dotenv.config()

const NODE_ENVS = ['development', 'production'] as const
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

export type Config = {
  supabase: {
    url: string
    serviceRoleKey: string
  }
  pennylane: {
    apiKey: string
    apiUrl: string
  }
  server: {
    port: number
    nodeEnv: (typeof NODE_ENVS)[number]
    internalApiToken: string | null
    allowedOrigins: string[]
    trustProxyHops: number
  }
  biltoki: {
    hallsToSync: string[]
    syncCronSchedule: string
  }
  logging: {
    level: (typeof LOG_LEVELS)[number]
  }
}

function requiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

function enumEnv<T extends string>(key: string, allowed: readonly T[], defaultValue: T): T {
  const value = optionalEnv(key, defaultValue)
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${key} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

function listEnv(key: string): string[] {
  return optionalEnv(key, '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function intEnv(key: string, defaultValue: number): number {
  const raw = optionalEnv(key, String(defaultValue))
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`)
  }
  return value
}

export function getConfig(): Config {
  const hallsToSync = listEnv('HALLS_TO_SYNC')
  if (hallsToSync.length === 0) {
    throw new Error('HALLS_TO_SYNC must contain at least one hall UUID (comma-separated)')
  }

  const internalApiToken = optionalEnv('INTERNAL_API_TOKEN', '')
  if (internalApiToken && internalApiToken.length < 32) {
    throw new Error('INTERNAL_API_TOKEN must be at least 32 characters')
  }

  const nodeEnv = enumEnv('NODE_ENV', NODE_ENVS, 'development')

  return {
    supabase: {
      url: requiredEnv('VITE_SUPABASE_URL'),
      serviceRoleKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
    pennylane: {
      apiKey: optionalEnv('PENNYLANE_API_KEY', ''),
      apiUrl: optionalEnv('PENNYLANE_API_URL', 'https://app.pennylane.com/api/external/v2'),
    },
    server: {
      port: parseInt(optionalEnv('PORT', '3000'), 10),
      nodeEnv,
      internalApiToken: internalApiToken || null,
      allowedOrigins: listEnv('ALLOWED_ORIGINS'),
      // Hosted deployments sit behind one reverse proxy; locally there is none.
      trustProxyHops: intEnv('TRUST_PROXY_HOPS', nodeEnv === 'production' ? 1 : 0),
    },
    biltoki: {
      hallsToSync,
      syncCronSchedule: optionalEnv('SYNC_CRON_SCHEDULE', '0 2 * * *'),
    },
    logging: {
      level: enumEnv('LOG_LEVEL', LOG_LEVELS, 'info'),
    },
  }
}
