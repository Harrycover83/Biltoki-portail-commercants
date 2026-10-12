import { afterEach, describe, expect, it, vi } from 'vitest'
import { PopinaClient } from './client.js'

const report = { id: 'r1', locationId: 'toulon', startedAt: '2026-10-01T10:00:00Z', finalizedAt: '2026-10-01T23:00:00Z', totalSales: 1000 }
const page = (data: unknown[], totalCount = data.length, totalPage = 1) =>
  new Response(JSON.stringify({ data, meta: { totalCount, totalPage } }))

afterEach(() => vi.unstubAllGlobals())

describe('Popina client', () => {
  it('uses server-side authentication and traverses all pages starting at zero', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page([report], 2, 2))
      .mockResolvedValueOnce(page([{ ...report, id: 'r2' }], 2, 2))
    vi.stubGlobal('fetch', fetchMock)
    const result = await new PopinaClient('test-key').getReports('2026-10-01', '2026-10-02', 'toulon')
    expect(result).toHaveLength(2)
    expect(fetchMock.mock.calls[0][0]).toContain('index=0')
    expect(fetchMock.mock.calls[1][0]).toContain('index=1')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key')
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error')
  })

  it.each([
    [{ ...report, locationId: 'other' }],
    [{ ...report, totalSales: 1.5 }],
    [{ ...report, startedAt: 'invalid' }],
  ])('rejects invalid or cross-location data', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page([data])))
    await expect(new PopinaClient('test-key').getReports('2026-10-01', '2026-10-02', 'toulon')).rejects.toThrow()
  })

  it('rejects duplicate and incomplete pagination instead of returning a partial total', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(page([report], 2, 2)).mockResolvedValueOnce(page([report], 2, 2))
    vi.stubGlobal('fetch', fetchMock)
    await expect(new PopinaClient('test-key').getReports('2026-10-01', '2026-10-02', 'toulon')).rejects.toThrow('Duplicate')
    fetchMock.mockResolvedValue(page([report], 2, 1))
    await expect(new PopinaClient('test-key').getReports('2026-10-01', '2026-10-02', 'toulon')).rejects.toThrow('Incomplete')
  })

  it('does not expose upstream error bodies or secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('sensitive body', { status: 401 })))
    await expect(new PopinaClient('test-key').getLocation()).rejects.toThrow('Popina request failed (HTTP 401)')
    await expect(new PopinaClient('').getLocation()).rejects.toThrow('not configured')
  })
})
