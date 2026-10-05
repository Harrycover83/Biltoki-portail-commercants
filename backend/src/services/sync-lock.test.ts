import { describe, expect, it } from 'vitest'
import { syncLock } from './sync-lock.js'

describe('syncLock', () => {
  it('refuses a second run for the same key while the first is in progress', async () => {
    let release!: () => void
    const first = syncLock.runExclusive('hall', () => new Promise<void>((resolve) => (release = resolve)))

    expect(syncLock.isRunning('hall')).toBe(true)
    await expect(syncLock.runExclusive('hall', async () => 'second')).rejects.toThrow('already running')

    release()
    await first
    expect(syncLock.isRunning('hall')).toBe(false)
  })

  it('does not block other keys and releases the lock when the task fails', async () => {
    await expect(syncLock.runExclusive('a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

    expect(syncLock.isRunning('a')).toBe(false)
    await expect(syncLock.runExclusive('b', async () => 'ok')).resolves.toBe('ok')
  })
})
