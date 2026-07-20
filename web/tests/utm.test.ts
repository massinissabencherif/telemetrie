import { describe, it, expect } from 'vitest'
import { captureTrafficSource } from '../app/utils/utm'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage
}

describe('captureTrafficSource', () => {
  it('extracts utm_source from the query string', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('?utm_source=newsletter', '', storage)
    expect(source.utm_source).toBe('newsletter')
  })

  it('falls back to the referrer hostname when there is no ref param', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('', 'https://www.google.com/search?q=perceuse', storage)
    expect(source.ref).toBe('www.google.com')
  })

  it('returns nulls for a direct visit with no query params or referrer', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('', '', storage)
    expect(source).toEqual({ utm_source: null, ref: null })
  })

  it('reuses the stored source on subsequent calls instead of re-parsing', () => {
    const storage = createMemoryStorage()
    captureTrafficSource('?utm_source=newsletter', '', storage)
    const second = captureTrafficSource('?utm_source=something-else', '', storage)
    expect(second.utm_source).toBe('newsletter')
  })

  it('falls back to nulls when the referrer is a malformed URL instead of throwing', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('', 'not-a-valid-url', storage)
    expect(source).toEqual({ utm_source: null, ref: null })
  })
})
