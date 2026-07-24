import { describe, it, expect } from 'vitest'
import {
  computeAverageCartValue,
  computeBounceRate,
  computeConversionRate,
  computeFunnelSteps,
  computeUtmBreakdown,
  findHighestDropoffStep,
  parseEventRecord
} from '../lib/metrics.mjs'

describe('computeBounceRate', () => {
  it('computes bounces as a percentage of visits', () => {
    expect(computeBounceRate({ bounces: 29, visits: 67 })).toBeCloseTo(43.28, 1)
  })

  it('returns 0 when there are no visits', () => {
    expect(computeBounceRate({ bounces: 0, visits: 0 })).toBe(0)
  })
})

describe('computeConversionRate', () => {
  it('computes checkout_success as a percentage of visits', () => {
    expect(computeConversionRate(8, 67)).toBeCloseTo(11.94, 1)
  })

  it('returns 0 when there are no visits', () => {
    expect(computeConversionRate(0, 0)).toBe(0)
  })
})

describe('computeFunnelSteps', () => {
  it('builds the 5-row funnel with pass rates relative to the previous step', () => {
    const steps = computeFunnelSteps(67, {
      view_product: 67,
      add_to_cart: 44,
      checkout_start: 32,
      checkout_success: 8
    })

    expect(steps[0]).toEqual({ name: 'Visites', count: 67, passRate: null })
    expect(steps[1]).toEqual({ name: 'view_product', count: 67, passRate: 100 })
    expect(steps[2]).toEqual({ name: 'add_to_cart', count: 44, passRate: expect.closeTo(65.67, 1) })
    expect(steps[3]).toEqual({ name: 'checkout_start', count: 32, passRate: expect.closeTo(72.73, 1) })
    expect(steps[4]).toEqual({ name: 'checkout_success', count: 8, passRate: 25 })
  })

  it('defaults missing event counts to 0 and avoids division by zero', () => {
    const steps = computeFunnelSteps(0, {})

    expect(steps.map((step) => step.count)).toEqual([0, 0, 0, 0, 0])
    expect(steps[1].passRate).toBe(0)
  })
})

describe('findHighestDropoffStep', () => {
  it('returns the step name with the lowest pass rate', () => {
    const steps = computeFunnelSteps(67, {
      view_product: 67,
      add_to_cart: 44,
      checkout_start: 32,
      checkout_success: 8
    })

    expect(findHighestDropoffStep(steps)).toBe('checkout_success')
  })
})

describe('parseEventRecord', () => {
  it('zips propertyKeys/propertyValues into an object, converting the "null" string to null', () => {
    const record = {
      propertyKeys: ['items', 'ref', 'utm_source', 'value'],
      propertyValues: ['1.0000', 'null', 'newsletter', '24.9000']
    }

    expect(parseEventRecord(record)).toEqual({
      items: '1.0000',
      ref: null,
      utm_source: 'newsletter',
      value: '24.9000'
    })
  })
})

describe('computeAverageCartValue', () => {
  it('averages the numeric value property across records', () => {
    const records = [
      { propertyKeys: ['value'], propertyValues: ['24.9000'] },
      { propertyKeys: ['value'], propertyValues: ['64.5000'] }
    ]

    expect(computeAverageCartValue(records)).toBeCloseTo(44.7, 1)
  })

  it('ignores records with a null value and returns 0 for an empty list', () => {
    expect(computeAverageCartValue([{ propertyKeys: ['value'], propertyValues: ['null'] }])).toBe(0)
    expect(computeAverageCartValue([])).toBe(0)
  })
})

describe('computeUtmBreakdown', () => {
  it('counts occurrences per utm_source, grouping missing values as "direct"', () => {
    const records = [
      { propertyKeys: ['utm_source'], propertyValues: ['newsletter'] },
      { propertyKeys: ['utm_source'], propertyValues: ['newsletter'] },
      { propertyKeys: ['utm_source'], propertyValues: ['null'] }
    ]

    expect(computeUtmBreakdown(records)).toEqual({ newsletter: 2, direct: 1 })
  })
})
