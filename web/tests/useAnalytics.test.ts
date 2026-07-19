import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackEvent } from '../app/composables/useAnalytics'

describe('trackEvent', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup only
    delete window.umami
  })

  it('does nothing when window.umami is not defined (script blocked or not loaded yet)', () => {
    expect(() => trackEvent('view_product', { product_id: 'p1' })).not.toThrow()
  })

  it('forwards the event name and props to window.umami.track', () => {
    const track = vi.fn()
    // @ts-expect-error test setup only
    window.umami = { track }
    trackEvent('add_to_cart', { product_id: 'p1', price: 10 })
    expect(track).toHaveBeenCalledWith('add_to_cart', { product_id: 'p1', price: 10 })
  })
})
