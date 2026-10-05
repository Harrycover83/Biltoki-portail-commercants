import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from './config.js'
import type { SupabaseAdmin } from './db/supabase.js'
import type { Logger } from './utils/logger.js'

const syncServiceCharges = vi.fn()

vi.mock('node-cron', () => ({
  default: {
    validate: (expression: string) => expression !== 'invalid',
    schedule: vi.fn((_expression: string, task: () => Promise<void>) => ({ stop: vi.fn(), run: task })),
  },
}))

vi.mock('./services/sync.service.js', () => ({
  PennylaneSync: vi.fn().mockImplementation((_db: unknown, _client: unknown, hallId: string) => ({
    syncServiceCharges: () => syncServiceCharges(hallId),
  })),
}))

const { setupScheduler } = await import('./scheduler.js')
const { syncLock } = await import('./services/sync-lock.js')

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger

function configFor(halls: string[], schedule = '0 2 * * *'): Config {
  return {
    pennylane: { apiKey: 'key', apiUrl: 'https://pennylane.test' },
    biltoki: { hallsToSync: halls, syncCronSchedule: schedule },
  } as unknown as Config
}

async function runScheduled(config: Config) {
  const task = setupScheduler(config, {} as SupabaseAdmin, logger) as unknown as { run: () => Promise<void> }
  await task.run()
}

describe('setupScheduler', () => {
  beforeEach(() => {
    syncServiceCharges.mockReset()
    syncServiceCharges.mockResolvedValue({ status: 'success', recordsProcessed: 1, errors: [] })
  })

  it('refuses an invalid cron expression at startup', () => {
    expect(() => setupScheduler(configFor(['a'], 'invalid'), {} as SupabaseAdmin, logger)).toThrow('SYNC_CRON_SCHEDULE')
  })

  it('syncs every configured hall, one after the other', async () => {
    const order: string[] = []
    syncServiceCharges.mockImplementation(async (hallId: string) => {
      order.push(`start:${hallId}`)
      await Promise.resolve()
      order.push(`end:${hallId}`)
      return { status: 'success', recordsProcessed: 1, errors: [] }
    })

    await runScheduled(configFor(['a', 'b']))

    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b'])
  })

  it('keeps going when one hall fails', async () => {
    syncServiceCharges.mockRejectedValueOnce(new Error('boom'))

    await runScheduled(configFor(['a', 'b']))

    expect(syncServiceCharges).toHaveBeenCalledTimes(2)
  })

  it('skips a hall whose sync is already running', async () => {
    await syncLock.runExclusive('a', async () => {
      await runScheduled(configFor(['a', 'b']))
    })

    expect(syncServiceCharges).toHaveBeenCalledTimes(1)
    expect(syncServiceCharges).toHaveBeenCalledWith('b')
  })
})
