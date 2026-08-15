import dotenv from 'dotenv'

dotenv.config()

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
    nodeEnv: 'development' | 'production'
  }
  biltoki: {
    hallsToSync: string[] // Multiple halls supported
    syncCronSchedule: string
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (!value && !defaultValue) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value || defaultValue || ''
}

export function getConfig(): Config {
  // Parse comma-separated hall IDs
  const hallsStr = getEnvVar('HALLS_TO_SYNC', '')
  const hallsToSync = hallsStr
    .split(',')
    .map(h => h.trim())
    .filter(h => h.length > 0)

  if (hallsToSync.length === 0) {
    throw new Error('HALLS_TO_SYNC must contain at least one hall UUID (comma-separated)')
  }

  return {
    supabase: {
      url: getEnvVar('VITE_SUPABASE_URL'),
      serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },
    pennylane: {
      apiKey: getEnvVar('PENNYLANE_API_KEY', ''),
      apiUrl: getEnvVar('PENNYLANE_API_URL', 'https://api.pennylane.io'),
    },
    server: {
      port: parseInt(getEnvVar('PORT', '3000'), 10),
      nodeEnv: (getEnvVar('NODE_ENV', 'development') as 'development' | 'production'),
    },
    biltoki: {
      hallsToSync,
      syncCronSchedule: getEnvVar('SYNC_CRON_SCHEDULE', '0 2 * * *'),
    },
    logging: {
      level: (getEnvVar('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
    },
  }
}
