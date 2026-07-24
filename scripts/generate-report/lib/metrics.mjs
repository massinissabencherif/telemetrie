export function computeBounceRate({ bounces = 0, visits = 0 } = {}) {
  if (visits === 0) return 0
  return (bounces / visits) * 100
}

export function computeConversionRate(checkoutSuccessCount = 0, visits = 0) {
  if (visits === 0) return 0
  return (checkoutSuccessCount / visits) * 100
}

export function computeFunnelSteps(visits = 0, eventCounts = {}) {
  const rawSteps = [
    { name: 'Visites', count: visits },
    { name: 'view_product', count: eventCounts.view_product ?? 0 },
    { name: 'add_to_cart', count: eventCounts.add_to_cart ?? 0 },
    { name: 'checkout_start', count: eventCounts.checkout_start ?? 0 },
    { name: 'checkout_success', count: eventCounts.checkout_success ?? 0 }
  ]

  return rawSteps.map((step, index) => {
    if (index === 0) return { ...step, passRate: null }

    const previousCount = rawSteps[index - 1].count
    const passRate = previousCount === 0 ? 0 : (step.count / previousCount) * 100
    return { ...step, passRate }
  })
}

export function findHighestDropoffStep(funnelSteps = []) {
  let worst = null

  for (const step of funnelSteps.slice(1)) {
    if (worst === null || step.passRate < worst.passRate) {
      worst = step
    }
  }

  return worst ? worst.name : null
}

export function parseEventRecord(record = {}) {
  const props = {}
  const keys = record.propertyKeys ?? []
  const values = record.propertyValues ?? []

  keys.forEach((key, index) => {
    const raw = values[index]
    props[key] = raw === 'null' ? null : raw
  })

  return props
}

export function computeAverageCartValue(records = []) {
  const values = records
    .map(parseEventRecord)
    .map((props) => props.value)
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite)

  if (values.length === 0) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeUtmBreakdown(records = []) {
  const breakdown = {}

  for (const record of records) {
    const props = parseEventRecord(record)
    const source = props.utm_source || 'direct'
    breakdown[source] = (breakdown[source] ?? 0) + 1
  }

  return breakdown
}
