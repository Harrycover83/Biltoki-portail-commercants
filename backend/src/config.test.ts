import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getConfig } from './config.js'

const HALL_A = '11111111-1111-1111-1111-111111111111'
const HALL_B = '22222222-2222-2222-2222-222222222222'

describe('getConfig', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
    vi.stubEnv('HALLS_TO_SYNC', `${HALL_A}, ${HALL_B} ,`)
    vi.stubEnv('INTERNAL_API_TOKEN', '')
    vi.stubEnv('ALLOWED_ORIGINS', '')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LOG_LEVEL', '')
    vi.stubEnv('PORT', '')
    vi.stubEnv('SYNC_CRON_SCHEDULE', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('applies defaults and trims comma-separated lists', () => {
    const config = getConfig()

    expect(config.biltoki.hallsToSync).toEqual([HALL_A, HALL_B])
    expect(config.biltoki.syncCronSchedule).toBe('0 2 * * *')
    expect(config.server.port).toBe(3000)
    expect(config.server.internalApiToken).toBeNull()
    expect(config.logging.level).toBe('info')
  })

  it('requires Supabase credentials', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    expect(() => getConfig()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('requires at least one hall to sync', () => {
    vi.stubEnv('HALLS_TO_SYNC', ' , ')

    expect(() => getConfig()).toThrow('HALLS_TO_SYNC')
  })

  it('rejects a short internal API token', () => {
    vi.stubEnv('INTERNAL_API_TOKEN', 'too-short')

    expect(() => getConfig()).toThrow('at least 32 characters')
  })

  it('rejects unknown log levels and environments', () => {
    vi.stubEnv('LOG_LEVEL', 'verbose')
    expect(() => getConfig()).toThrow('LOG_LEVEL')

    vi.stubEnv('LOG_LEVEL', 'warn')
    vi.stubEnv('NODE_ENV', 'staging')
    expect(() => getConfig()).toThrow('NODE_ENV')
  })
})
