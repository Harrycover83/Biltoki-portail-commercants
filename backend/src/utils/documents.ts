import type { IncomingMessage } from 'node:http'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { createSafeLookup } from './network.js'

// Only passive formats are served inline. SVG/HTML/etc. are excluded on purpose: files attached to
// supplier invoices are untrusted, and an SVG opened from the portal's origin could run scripts.
const INLINE_CONTENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 20_000

const safeLookup = createSafeLookup()

export function safeDocumentContentType(header: string | null): string {
  const type = (header ?? '').split(';')[0].trim().toLowerCase()
  return INLINE_CONTENT_TYPES.includes(type) ? type : 'application/octet-stream'
}

/** Refuses anything but a public https hostname (no credentials, IP literal, localhost or internal name). */
export function isSafeDocumentUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  const host = url.hostname.toLowerCase()
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    isIP(host.replace(/^\[|\]$/g, '')) === 0 &&
    host !== 'localhost' &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.local') &&
    !host.endsWith('.internal') &&
    host.includes('.')
  )
}

class DocumentFetchError extends Error {}

/** One HTTPS GET without redirect following; the DNS answer is validated when the socket connects. */
function get(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', lookup: safeLookup, timeout: FETCH_TIMEOUT_MS }, resolve)
    req.on('timeout', () => req.destroy(new DocumentFetchError('Document download timed out')))
    req.on('error', reject)
    req.end()
  })
}

/** Reads the body, aborting as soon as it exceeds the size cap. */
async function readBody(response: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of response) {
    size += (chunk as Buffer).length
    if (size > MAX_DOCUMENT_BYTES) {
      response.destroy()
      throw new DocumentFetchError('Document too large')
    }
    chunks.push(chunk as Buffer)
  }

  return Buffer.concat(chunks)
}

/**
 * Downloads a document with a timeout, a size cap, validation of every redirect hop and a connection-time
 * check that the host resolves to public addresses only.
 */
export async function fetchDocument(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
  let current = rawUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isSafeDocumentUrl(current)) {
      throw new DocumentFetchError('Document URL refused')
    }

    const response = await get(current)
    const status = response.statusCode ?? 0

    if (status >= 300 && status < 400) {
      response.resume()
      const location = response.headers.location
      if (!location) {
        throw new DocumentFetchError('Invalid redirect')
      }
      current = new URL(location, current).toString()
      continue
    }

    if (status < 200 || status >= 300) {
      response.resume()
      throw new DocumentFetchError(`Document download failed: ${status}`)
    }

    if (Number(response.headers['content-length'] ?? 0) > MAX_DOCUMENT_BYTES) {
      response.destroy()
      throw new DocumentFetchError('Document too large')
    }

    return {
      body: await readBody(response),
      contentType: safeDocumentContentType(response.headers['content-type'] ?? null),
    }
  }

  throw new DocumentFetchError('Too many redirects')
}
