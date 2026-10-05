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
    vi.stubEnv('TRUST_PROXY_HOPS', '')
    vi.stubEnv('PENNYLANE_HALL_CATEGORIES', '')
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
    expect(config.server.trustProxyHops).toBe(0)
    expect(config.logging.level).toBe('info')
    expect(Object.keys(config.pennylane.hallCategories)).toHaveLength(1)
  })

  it('merges PENNYLANE_HALL_CATEGORIES over the built-in mapping', () => {
    vi.stubEnv('PENNYLANE_HALL_CATEGORIES', JSON.stringify({ 'hall-9': { categoryId: 7, label: 'X' } }))

    const { hallCategories } = getConfig().pennylane

    expect(Object.keys(hallCategories)).toHaveLength(2)
    expect(hallCategories['hall-9']).toEqual({ categoryId: 7, label: 'X' })

    vi.stubEnv('PENNYLANE_HALL_CATEGORIES', '{nope')
    expect(() => getConfig()).toThrow('PENNYLANE_HALL_CATEGORIES')
  })

  it('trusts one reverse proxy in production unless told otherwise', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(getConfig().server.trustProxyHops).toBe(1)

    vi.stubEnv('TRUST_PROXY_HOPS', '2')
    expect(getConfig().server.trustProxyHops).toBe(2)

    vi.stubEnv('TRUST_PROXY_HOPS', 'many')
    expect(() => getConfig()).toThrow('TRUST_PROXY_HOPS')
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
