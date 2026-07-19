const STORAGE_KEY = 'eshop_traffic_source'

export interface TrafficSource {
  utm_source: string | null
  ref: string | null
}

export function captureTrafficSource(search: string, referrer: string, storage: Storage = sessionStorage): TrafficSource {
  const existing = storage.getItem(STORAGE_KEY)
  if (existing) {
    return JSON.parse(existing) as TrafficSource
  }

  const params = new URLSearchParams(search)
  const source: TrafficSource = {
    utm_source: params.get('utm_source'),
    ref: params.get('ref') ?? (referrer ? new URL(referrer).hostname : null)
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(source))
  return source
}
