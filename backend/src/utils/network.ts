import { lookup as dnsLookup, promises as dnsPromises } from 'node:dns'
import { BlockList, isIP } from 'node:net'

type Family = 'ipv4' | 'ipv6'

/** Ranges that must never be reachable from a server-side download (private, loopback, link-local, reserved). */
const NON_PUBLIC = new BlockList()
const NON_PUBLIC_RANGES: [string, number, Family][] = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.0.0.0', 24, 'ipv4'],
  ['192.0.2.0', 24, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['198.51.100.0', 24, 'ipv4'],
  ['203.0.113.0', 24, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['240.0.0.0', 4, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['::1', 128, 'ipv6'],
  ['64:ff9b::', 96, 'ipv6'],
  ['100::', 64, 'ipv6'],
  ['2001:db8::', 32, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
]
for (const [network, prefix, family] of NON_PUBLIC_RANGES) {
  NON_PUBLIC.addSubnet(network, prefix, family)
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 0) {
    return false
  }
  return !NON_PUBLIC.check(address, version === 4 ? 'ipv4' : 'ipv6')
}

export class UnsafeAddressError extends Error {}

type Resolve = (hostname: string) => Promise<{ address: string; family: number }[]>

const resolveAll: Resolve = (hostname) => dnsPromises.lookup(hostname, { all: true, verbatim: true })

/**
 * `lookup` function for http(s) agents: resolves the hostname and refuses it unless EVERY address is public.
 * Validating at connection time (rather than before the request) closes the DNS-rebinding window.
 */
export function createSafeLookup(resolve: Resolve = resolveAll): typeof dnsLookup {
  const safeLookup = (
    hostname: string,
    options: { all?: boolean },
    callback: (error: Error | null, address?: unknown, family?: number) => void,
  ) => {
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
          callback(new UnsafeAddressError(`Refusing to connect to a non-public address for ${hostname}`))
          return
        }
        if (options.all) {
          callback(null, addresses)
          return
        }
        callback(null, addresses[0].address, addresses[0].family)
      },
      (error: Error) => callback(error),
    )
  }
  return safeLookup as unknown as typeof dnsLookup
}
