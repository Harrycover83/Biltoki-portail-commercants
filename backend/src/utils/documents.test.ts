import { describe, expect, it } from 'vitest'
import { isSafeDocumentUrl, safeDocumentContentType } from './documents.js'

describe('safeDocumentContentType', () => {
  it('serves PDFs and raster images inline', () => {
    expect(safeDocumentContentType('application/pdf')).toBe('application/pdf')
    expect(safeDocumentContentType('image/PNG; charset=binary')).toBe('image/png')
    expect(safeDocumentContentType('image/jpeg')).toBe('image/jpeg')
  })

  it('never serves active content inline', () => {
    for (const type of ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/xml', 'application/javascript', null, '']) {
      expect(safeDocumentContentType(type)).toBe('application/octet-stream')
    }
  })
})

describe('isSafeDocumentUrl', () => {
  it('accepts public https URLs', () => {
    expect(isSafeDocumentUrl('https://files.example.com/a/b.pdf?sig=1')).toBe(true)
  })

  it('refuses non-https, credentials, IP literals and internal hosts', () => {
    for (const url of [
      'http://files.example.com/a.pdf',
      'https://user:pass@files.example.com/a.pdf',
      'https://127.0.0.1/a.pdf',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/a.pdf',
      'https://localhost/a.pdf',
      'https://db.internal/a.pdf',
      'https://printer.local/a.pdf',
      'https://intranet/a.pdf',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(isSafeDocumentUrl(url)).toBe(false)
    }
  })
})
