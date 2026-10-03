import { isIP } from 'node:net'

// Only passive formats are served inline. SVG/HTML/etc. are excluded on purpose: files attached to
// supplier invoices are untrusted, and an SVG opened from the portal's origin could run scripts.
const INLINE_CONTENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 20_000

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

export class DocumentFetchError extends Error {}

/** Downloads a document with a timeout, a size cap, and validation of every redirect hop. */
export async function fetchDocument(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
  let current = rawUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isSafeDocumentUrl(current)) {
      throw new DocumentFetchError('Document URL refused')
    }

    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new DocumentFetchError('Invalid redirect')
      }
      current = new URL(location, current).toString()
      continue
    }

    if (!response.ok) {
      throw new DocumentFetchError(`Document download failed: ${response.status}`)
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_DOCUMENT_BYTES) {
      throw new DocumentFetchError('Document too large')
    }

    const body = Buffer.from(await response.arrayBuffer())
    if (body.length > MAX_DOCUMENT_BYTES) {
      throw new DocumentFetchError('Document too large')
    }

    return { body, contentType: safeDocumentContentType(response.headers.get('content-type')) }
  }

  throw new DocumentFetchError('Too many redirects')
}
