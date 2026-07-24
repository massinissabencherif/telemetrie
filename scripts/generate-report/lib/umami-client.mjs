function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

async function readJsonResponse(res, label) {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const detail = body ? `: ${body.slice(0, 200)}` : ''
    throw new Error(`${label} failed: HTTP ${res.status}${detail}`)
  }

  return res.json()
}

export async function login(host, username, password) {
  const baseUrl = trimTrailingSlash(host)
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const body = await readJsonResponse(res, 'Umami login')

  if (!body.token) {
    throw new Error('Umami login failed: missing token in response')
  }

  return body.token
}

export async function fetchStats(host, token, websiteId, startAt, endAt) {
  const baseUrl = trimTrailingSlash(host)
  const url = new URL(`${baseUrl}/api/websites/${websiteId}/stats`)
  url.searchParams.set('startAt', String(startAt))
  url.searchParams.set('endAt', String(endAt))

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  return readJsonResponse(res, 'Umami stats fetch')
}

export async function fetchEventCounts(host, token, websiteId, startAt, endAt) {
  const baseUrl = trimTrailingSlash(host)
  const url = new URL(`${baseUrl}/api/websites/${websiteId}/metrics`)
  url.searchParams.set('type', 'event')
  url.searchParams.set('startAt', String(startAt))
  url.searchParams.set('endAt', String(endAt))

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const rows = await readJsonResponse(res, 'Umami event metrics fetch')
  const counts = {}

  for (const row of rows) {
    counts[row.x] = Number(row.y)
  }

  return counts
}

export async function fetchEventRecords(host, token, websiteId, eventName, startAt, endAt) {
  const baseUrl = trimTrailingSlash(host)
  const url = new URL(`${baseUrl}/api/websites/${websiteId}/event-data-pivot`)
  url.searchParams.set('eventName', eventName)
  url.searchParams.set('startAt', String(startAt))
  url.searchParams.set('endAt', String(endAt))
  url.searchParams.set('unit', 'hour')
  url.searchParams.set('timezone', 'Europe/Paris')
  url.searchParams.set('maxResults', '10000')

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const body = await readJsonResponse(res, 'Umami event-data-pivot fetch')

  return body.data ?? []
}
