import { describe, it, expect } from 'vitest'
import { simulatePayment } from '../app/utils/payment'

function queue(values: number[]) {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('simulatePayment', () => {
  it('succeeds when the draw is above the 1/3 failure threshold', () => {
    const result = simulatePayment(queue([0.9]))
    expect(result).toEqual({ success: true })
  })

  it('fails with a TypeError when the failure branch draws below 0.5', () => {
    const result = simulatePayment(queue([0.1, 0.1]))
    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(TypeError)
  })

  it('fails with a generic rejected-payment Error when the failure branch draws at or above 0.5', () => {
    const result = simulatePayment(queue([0.1, 0.9]))
    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error).not.toBeInstanceOf(TypeError)
  })
})
