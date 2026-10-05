import { describe, expect, it, vi } from 'vitest'
import { createSafeLookup, isPublicAddress, UnsafeAddressError } from './network.js'

describe('isPublicAddress', () => {
  it('accepts public addresses', () => {
    for (const address of ['8.8.8.8', '151.101.1.69', '2606:4700:4700::1111']) {
      expect(isPublicAddress(address)).toBe(true)
    }
  })

  it('refuses private, loopback, link-local and reserved addresses', () => {
    for (const address of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.5.5',
      '172.31.255.255',
      '192.168.1.1',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPublicAddress(address)).toBe(false)
    }
  })

  it('refuses anything that is not an IP address', () => {
    expect(isPublicAddress('example.com')).toBe(false)
    expect(isPublicAddress('')).toBe(false)
  })
})

describe('createSafeLookup', () => {
  function run(addresses: { address: string; family: number }[], options: { all?: boolean } = {}) {
    const lookup = createSafeLookup(async () => addresses) as unknown as (
      hostname: string,
      options: { all?: boolean },
      callback: (error: Error | null, address?: unknown, family?: number) => void,
    ) => void
    return new Promise<{ error: Error | null; address?: unknown; family?: number }>((resolve) => {
      lookup('files.example.com', options, (error, address, family) => resolve({ error, address, family }))
    })
  }

  it('resolves to the first address when all of them are public', async () => {
    const result = await run([{ address: '8.8.8.8', family: 4 }])
    expect(result).toEqual({ error: null, address: '8.8.8.8', family: 4 })
  })

  it('returns every address when the caller asks for all of them', async () => {
    const addresses = [
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]
    expect((await run(addresses, { all: true })).address).toEqual(addresses)
  })

  it('refuses a hostname when any address is not public (DNS rebinding)', async () => {
    const result = await run([
      { address: '8.8.8.8', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])
    expect(result.error).toBeInstanceOf(UnsafeAddressError)
  })

  it('refuses an empty answer and propagates resolver failures', async () => {
    expect((await run([])).error).toBeInstanceOf(UnsafeAddressError)

    const failing = createSafeLookup(async () => {
      throw new Error('ENOTFOUND')
    }) as unknown as (h: string, o: object, cb: (e: Error | null) => void) => void
    const callback = vi.fn()
    failing('nowhere.example', {}, callback)
    await vi.waitFor(() => expect(callback).toHaveBeenCalled())
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})
