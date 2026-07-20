# Observability Report Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single CLI command (`scripts/generate-report`) that logs into Umami and GlitchTip, captures the four screenshots `docs/rapport-observabilite.md` already references, computes the real Umami metrics via its REST API, and renders `docs/rapport-observabilite.pdf` — fully satisfying Sujet.md §5.3 without manual dashboard work.

**Architecture:** A pure computation module (bounce/conversion/drop-off rates, cart-value/UTM aggregation) is unit tested in isolation. Two Playwright-driven capture modules log into the real Umami and GlitchTip UIs and take the screenshots. A thin Umami REST API client fetches the numbers. A renderer fills named tokens in the existing markdown template and prints it to PDF via Playwright's `page.pdf()`. An orchestrator wires these together, catching each step's errors independently so a partial run still produces a usable, honestly-partial PDF.

**Tech Stack:** Node.js 22 (`--env-file` for config, no `dotenv` dependency), Playwright 1.61 (already used by `scripts/demo-traffic`), `marked` 18 for markdown→HTML, Vitest 4 for the pure-function tests.

## Global Constraints

- No web UI — this is a CLI script (`node generate-report.mjs`), matching `scripts/demo-traffic`'s pattern.
- Numbers (visits, bounce rate, conversion rate, funnel drop-off, average cart value, `utm_source` breakdown) are computed automatically from live data. Interpretive prose (why a step drops off, how to fix the bug) stays hand-written in the template — never fabricated.
- Every network/browser step is independently try/caught; a failure in one section logs clearly and leaves that section's placeholder untouched rather than aborting the whole run or writing a fabricated value.
- Credentials live in `.env` only (gitignored): `UMAMI_ADMIN_USERNAME`, `UMAMI_ADMIN_PASSWORD`, `GLITCHTIP_EMAIL`, `GLITCHTIP_PASSWORD`, `GLITCHTIP_HOST`. These four plus `NUXT_PUBLIC_UMAMI_HOST`/`NUXT_PUBLIC_UMAMI_WEBSITE_ID` (already present) are the script's only config.
- Verified live against the running stack during planning (values below are not guesses):
  - Umami login form: `input[name=username]`, `input[name=password]`, `button[type=submit]`.
  - Umami overview page: `GET {host}/websites/{websiteId}`.
  - Umami REST API: `POST /api/auth/login` → `{token}`; `GET /api/websites/{id}/stats?startAt&endAt` → `{pageviews,visitors,visits,bounces,totaltime}`; `GET /api/websites/{id}/metrics?type=event&startAt&endAt` → `[{x: eventName, y: count}]`; `GET /api/websites/{id}/event-data-pivot?eventName=X&startAt&endAt&unit=hour&timezone=Europe%2FParis&maxResults=10000` → `{data: [{propertyKeys: [...], propertyValues: [...]}]}` (values are strings, `"null"` literal for absent).
  - GlitchTip login form: `input[type=email]`, `input[type=password]`, button with text `Log in`.
  - GlitchTip org slug: `eshop-monitor-web`. Issues list: `GET {host}/eshop-monitor-web/issues`, search box is `input[type=search]`. Issue detail: `GET {host}/eshop-monitor-web/issues/{id}`.
  - GlitchTip Performance: `GET {host}/eshop-monitor-web/performance/transaction-groups`, a plain-text row list (`Title` / `Average Duration` columns) — no API needed, robust to scrape directly.
  - GlitchTip's Angular Material UI scrolls inside `mat-sidenav-content`, not `document.body` — full-page capture requires screenshotting that locator with a tall viewport, not `page.screenshot({fullPage:true})`.
  - A dedicated GlitchTip account already exists and is a member of the org: `report-bot@eshop-monitor-reports.com` (credentials already in `.env`). Do not use the project owner's personal login.
- The Umami Funnel report (`{host}/websites/{id}/funnels`) requires a one-time manual creation (no default funnel exists) — this plan documents that one-time setup in Task 7's README section rather than automating a fragile custom-combobox form fill. The capture script always screenshots the funnels page as-is: once created, the funnel persists across all future runs.

---

## File Structure

```
scripts/generate-report/
├── package.json                 (playwright, marked)
├── generate-report.mjs          (orchestrator / CLI entrypoint)
├── lib/
│   ├── metrics.mjs              (pure computation — tested)
│   ├── umami-client.mjs         (Umami REST API calls)
│   ├── umami-capture.mjs        (Playwright: Umami screenshots)
│   ├── glitchtip-capture.mjs    (Playwright: GlitchTip screenshots + performance numbers)
│   └── render-pdf.mjs           (token substitution + markdown -> HTML -> PDF)
└── tests/
    └── metrics.test.mjs
```

`docs/rapport-observabilite.md` (existing) gets its `___` placeholders replaced with named `{{TOKEN}}` markers in Task 1, so substitution is unambiguous. `docs/screenshots/` (existing, empty) is where captures land, matching the paths the template's `![...]()` tags already use.

---

### Task 1: Replace generic placeholders with named tokens in the report template

**Files:**
- Modify: `docs/rapport-observabilite.md`

**Interfaces:**
- Produces: the exact token names Task 6 (`render-pdf.mjs`) substitutes — `TOTAL_VISITS`, `CHECKOUT_SUCCESS_COUNT`, `CONVERSION_RATE`, `VIEW_PRODUCT_COUNT`, `VIEW_PRODUCT_RATE`, `ADD_TO_CART_COUNT`, `ADD_TO_CART_RATE`, `CHECKOUT_START_COUNT`, `CHECKOUT_START_RATE`, `CHECKOUT_SUCCESS_RATE`, `HIGHEST_DROPOFF_STEP`, `UNIQUE_VISITORS`, `PAGEVIEWS`, `AVG_SESSION_DURATION`, `BOUNCE_RATE`, `AVG_CART_VALUE`, `UTM_BREAKDOWN`, `CHECKOUT_DURATION_MS`, `CHECKOUT_SUCCESS_DURATION_MS`.

- [ ] **Step 1: Replace section 1's placeholders**

In `docs/rapport-observabilite.md`, replace:

```markdown
**Analyse du taux de conversion :**
- Visites totales (période testée) : `___`
- `checkout_success` : `___`
- Taux de conversion global = checkout_success / visites totales = `___ %`

**Analyse de l'abandon par étape :**

| Étape | Nombre d'événements | Taux de passage vs étape précédente |
| --- | --- | --- |
| Visites | `___` | — |
| `view_product` | `___` | `___ %` |
| `add_to_cart` | `___` | `___ %` |
| `checkout_start` | `___` | `___ %` |
| `checkout_success` | `___` | `___ %` |

Étape avec le plus fort abandon observé : `___` (commenter la cause probable : friction du formulaire, hésitation sur le prix, échec de paiement simulé, etc.)
```

with:

```markdown
**Analyse du taux de conversion :**
- Visites totales (période testée) : `{{TOTAL_VISITS}}`
- `checkout_success` : `{{CHECKOUT_SUCCESS_COUNT}}`
- Taux de conversion global = checkout_success / visites totales = `{{CONVERSION_RATE}} %`

**Analyse de l'abandon par étape :**

| Étape | Nombre d'événements | Taux de passage vs étape précédente |
| --- | --- | --- |
| Visites | `{{TOTAL_VISITS}}` | — |
| `view_product` | `{{VIEW_PRODUCT_COUNT}}` | `{{VIEW_PRODUCT_RATE}} %` |
| `add_to_cart` | `{{ADD_TO_CART_COUNT}}` | `{{ADD_TO_CART_RATE}} %` |
| `checkout_start` | `{{CHECKOUT_START_COUNT}}` | `{{CHECKOUT_START_RATE}} %` |
| `checkout_success` | `{{CHECKOUT_SUCCESS_COUNT}}` | `{{CHECKOUT_SUCCESS_RATE}} %` |

Étape avec le plus fort abandon observé : `{{HIGHEST_DROPOFF_STEP}}` (commenter la cause probable : friction du formulaire, hésitation sur le prix, échec de paiement simulé, etc.)
```

- [ ] **Step 2: Replace section 2's placeholders**

Replace:

```markdown
- Sessions uniques : `___`
- Pages vues : `___`
- Durée moyenne de session : `___`
- Taux de rebond (page d'accueil) : `___ %` — commenter si ce taux est cohérent avec le scénario de démonstration simulé.
```

with:

```markdown
- Sessions uniques : `{{UNIQUE_VISITORS}}`
- Pages vues : `{{PAGEVIEWS}}`
- Durée moyenne de session : `{{AVG_SESSION_DURATION}}`
- Taux de rebond (page d'accueil) : `{{BOUNCE_RATE}} %` — commenter si ce taux est cohérent avec le scénario de démonstration simulé.
```

- [ ] **Step 3: Replace section 3's placeholders**

Replace:

```markdown
- Montant moyen des `checkout_success` (propriété `value`) : `___ €`
- Répartition des `checkout_success` par `utm_source` : `___`
```

with:

```markdown
- Montant moyen des `checkout_success` (propriété `value`) : `{{AVG_CART_VALUE}} €`
- Répartition des `checkout_success` par `utm_source` : `{{UTM_BREAKDOWN}}`
```

- [ ] **Step 4: Replace section 5's placeholders**

Replace:

```markdown
- Temps de chargement médian observé pour `/checkout` : `___ ms`
- Temps de chargement médian observé pour `/checkout/success` (page de validation de commande) : `___ ms`
```

with:

```markdown
- Temps de chargement médian observé pour `/checkout` : `{{CHECKOUT_DURATION_MS}} ms`
- Temps de chargement médian observé pour `/checkout/success` (page de validation de commande) : `{{CHECKOUT_SUCCESS_DURATION_MS}} ms`
```

- [ ] **Step 5: Verify no stray `___` placeholders remain outside intentional prose**

```bash
grep -n '___' docs/rapport-observabilite.md
```

Expected: no output (all numeric placeholders replaced; the file has no other `___` occurrences).

- [ ] **Step 6: Commit**

```bash
git add docs/rapport-observabilite.md
git commit -m "docs: replace generic report placeholders with named tokens for automated fill-in"
```

---

### Task 2: Pure metrics computation module (TDD)

**Files:**
- Create: `scripts/generate-report/package.json`
- Create: `scripts/generate-report/lib/metrics.mjs`
- Create: `scripts/generate-report/tests/metrics.test.mjs`
- Create: `scripts/generate-report/vitest.config.mjs`

**Interfaces:**
- Produces: `computeBounceRate({bounces, visits}): number`, `computeConversionRate(checkoutSuccessCount, visits): number`, `computeFunnelSteps(visits, eventCounts): Array<{name, count, passRate}>`, `findHighestDropoffStep(funnelSteps): string`, `parseEventRecord(record): Record<string, string|null>`, `computeAverageCartValue(records): number`, `computeUtmBreakdown(records): Record<string, number>`. `eventCounts` shape: `{view_product?, add_to_cart?, checkout_start?, checkout_success?}`. `records` shape: array of `{propertyKeys: string[], propertyValues: string[]}` (the raw shape returned by Umami's `event-data-pivot` endpoint — see Task 3). Used by Task 6 (renderer) via Task 7 (orchestrator).

- [ ] **Step 1: Create `scripts/generate-report/package.json`**

```json
{
  "name": "eshop-monitor-generate-report",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --env-file=../../.env generate-report.mjs",
    "test": "vitest run"
  },
  "dependencies": {
    "playwright": "^1.61.1",
    "marked": "^18.0.6"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `scripts/generate-report/vitest.config.mjs`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs']
  }
})
```

- [ ] **Step 3: Write the failing test**

```js
// scripts/generate-report/tests/metrics.test.mjs
import { describe, it, expect } from 'vitest'
import {
  computeBounceRate,
  computeConversionRate,
  computeFunnelSteps,
  findHighestDropoffStep,
  parseEventRecord,
  computeAverageCartValue,
  computeUtmBreakdown
} from '../lib/metrics.mjs'

describe('computeBounceRate', () => {
  it('computes bounces as a percentage of visits', () => {
    expect(computeBounceRate({ bounces: 29, visits: 67 })).toBeCloseTo(43.28, 1)
  })

  it('returns 0 when there are no visits (no division by zero)', () => {
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
    expect(steps).toEqual([
      { name: 'Visites', count: 67, passRate: null },
      { name: 'view_product', count: 67, passRate: 100 },
      { name: 'add_to_cart', count: 44, passRate: expect.closeTo(65.67, 1) },
      { name: 'checkout_start', count: 32, passRate: expect.closeTo(72.73, 1) },
      { name: 'checkout_success', count: 8, passRate: 25 }
    ])
  })

  it('defaults missing event counts to 0 and avoids division by zero', () => {
    const steps = computeFunnelSteps(0, {})
    expect(steps.map((s) => s.count)).toEqual([0, 0, 0, 0, 0])
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
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd scripts/generate-report && npm install && npx vitest run tests/metrics.test.mjs
```

Expected: FAIL — `../lib/metrics.mjs` does not exist.

- [ ] **Step 5: Create `scripts/generate-report/lib/metrics.mjs`**

```js
export function computeBounceRate({ bounces, visits }) {
  if (visits === 0) return 0
  return (bounces / visits) * 100
}

export function computeConversionRate(checkoutSuccessCount, visits) {
  if (visits === 0) return 0
  return (checkoutSuccessCount / visits) * 100
}

export function computeFunnelSteps(visits, eventCounts) {
  const rawSteps = [
    { name: 'Visites', count: visits },
    { name: 'view_product', count: eventCounts.view_product ?? 0 },
    { name: 'add_to_cart', count: eventCounts.add_to_cart ?? 0 },
    { name: 'checkout_start', count: eventCounts.checkout_start ?? 0 },
    { name: 'checkout_success', count: eventCounts.checkout_success ?? 0 }
  ]
  return rawSteps.map((step, i) => {
    if (i === 0) return { ...step, passRate: null }
    const previousCount = rawSteps[i - 1].count
    const passRate = previousCount === 0 ? 0 : (step.count / previousCount) * 100
    return { ...step, passRate }
  })
}

export function findHighestDropoffStep(funnelSteps) {
  let worst = null
  for (const step of funnelSteps.slice(1)) {
    if (worst === null || step.passRate < worst.passRate) worst = step
  }
  return worst ? worst.name : null
}

export function parseEventRecord(record) {
  const props = {}
  record.propertyKeys.forEach((key, i) => {
    const raw = record.propertyValues[i]
    props[key] = raw === 'null' ? null : raw
  })
  return props
}

export function computeAverageCartValue(records) {
  const values = records
    .map(parseEventRecord)
    .map((p) => p.value)
    .filter((v) => v !== null && v !== undefined)
    .map(Number)
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function computeUtmBreakdown(records) {
  const breakdown = {}
  for (const record of records) {
    const props = parseEventRecord(record)
    const source = props.utm_source ?? 'direct'
    breakdown[source] = (breakdown[source] ?? 0) + 1
  }
  return breakdown
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd scripts/generate-report && npx vitest run tests/metrics.test.mjs
```

Expected: PASS (11 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-report/package.json scripts/generate-report/vitest.config.mjs scripts/generate-report/lib/metrics.mjs scripts/generate-report/tests/metrics.test.mjs
git commit -m "feat: add pure metrics computation module for the report generator (TDD)"
```

---

### Task 3: Umami REST API client

**Files:**
- Create: `scripts/generate-report/lib/umami-client.mjs`

**Interfaces:**
- Produces: `login(host, username, password): Promise<string>` (bearer token), `fetchStats(host, token, websiteId, startAt, endAt): Promise<{pageviews, visitors, visits, bounces, totaltime}>`, `fetchEventCounts(host, token, websiteId, startAt, endAt): Promise<Record<string, number>>`, `fetchEventRecords(host, token, websiteId, eventName, startAt, endAt): Promise<Array<{propertyKeys, propertyValues}>>`. Consumed by Task 7 (orchestrator); `fetchEventRecords`'s return shape matches exactly what Task 2's `parseEventRecord`/`computeAverageCartValue`/`computeUtmBreakdown` expect.

- [ ] **Step 1: Create `scripts/generate-report/lib/umami-client.mjs`**

```js
export async function login(host, username, password) {
  const res = await fetch(`${host}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) throw new Error(`Umami login failed: HTTP ${res.status}`)
  const { token } = await res.json()
  return token
}

export async function fetchStats(host, token, websiteId, startAt, endAt) {
  const url = `${host}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Umami stats fetch failed: HTTP ${res.status}`)
  return res.json()
}

export async function fetchEventCounts(host, token, websiteId, startAt, endAt) {
  const url = `${host}/api/websites/${websiteId}/metrics?type=event&startAt=${startAt}&endAt=${endAt}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Umami event metrics fetch failed: HTTP ${res.status}`)
  const rows = await res.json()
  const counts = {}
  for (const row of rows) counts[row.x] = row.y
  return counts
}

export async function fetchEventRecords(host, token, websiteId, eventName, startAt, endAt) {
  const params = new URLSearchParams({
    eventName,
    startAt: String(startAt),
    endAt: String(endAt),
    unit: 'hour',
    timezone: 'Europe/Paris',
    maxResults: '10000'
  })
  const url = `${host}/api/websites/${websiteId}/event-data-pivot?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Umami event-data-pivot fetch failed: HTTP ${res.status}`)
  const body = await res.json()
  return body.data
}
```

- [ ] **Step 2: Verify live against the running stack**

```bash
cd scripts/generate-report
node --env-file=../../.env -e '
import("./lib/umami-client.mjs").then(async (m) => {
  const host = process.env.NUXT_PUBLIC_UMAMI_HOST
  const websiteId = process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID
  const token = await m.login(host, process.env.UMAMI_ADMIN_USERNAME, process.env.UMAMI_ADMIN_PASSWORD)
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  console.log("stats:", await m.fetchStats(host, token, websiteId, weekAgo, now))
  console.log("events:", await m.fetchEventCounts(host, token, websiteId, weekAgo, now))
  const records = await m.fetchEventRecords(host, token, websiteId, "checkout_success", weekAgo, now)
  console.log("checkout_success records:", records.length)
})
'
```

Expected: prints real `stats` (visits/bounces/pageviews > 0), an `events` object with `view_product`/`add_to_cart`/`checkout_start`/`checkout_success` counts, and a positive `checkout_success records` count — confirming all four live calls succeed against the real Umami instance.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-report/lib/umami-client.mjs
git commit -m "feat: add Umami REST API client for the report generator"
```

---

### Task 4: Umami screenshot capture

**Files:**
- Create: `scripts/generate-report/lib/umami-capture.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone Playwright module).
- Produces: `captureUmamiScreenshots({host, username, password, websiteId, outDir}): Promise<void>`, writing `01-tunnel-umami.png` and `02-metriques-umami.png` into `outDir`. Consumed by Task 7 (orchestrator).

- [ ] **Step 1: Create `scripts/generate-report/lib/umami-capture.mjs`**

```js
import { chromium } from 'playwright'

export async function captureUmamiScreenshots({ host, username, password, websiteId, outDir }) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    await page.goto(`${host}/login`)
    await page.fill('input[name=username]', username)
    await page.fill('input[name=password]', password)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1200)

    await page.goto(`${host}/websites/${websiteId}`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${outDir}/02-metriques-umami.png` })

    // Requires a funnel to have been created once via the Umami UI (README
    // documents the one-time setup) — if none exists yet, this screenshots
    // the funnels page's empty state, which is honest, visible feedback
    // rather than a silent wrong capture.
    await page.goto(`${host}/websites/${websiteId}/funnels`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${outDir}/01-tunnel-umami.png` })

    await browser.close()
  } catch (err) {
    await browser.close()
    throw err
  }
}
```

- [ ] **Step 2: Verify live against the running stack**

```bash
cd scripts/generate-report
mkdir -p /tmp/report-capture-test
node --env-file=../../.env -e '
import("./lib/umami-capture.mjs").then(async (m) => {
  await m.captureUmamiScreenshots({
    host: process.env.NUXT_PUBLIC_UMAMI_HOST,
    username: process.env.UMAMI_ADMIN_USERNAME,
    password: process.env.UMAMI_ADMIN_PASSWORD,
    websiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID,
    outDir: "/tmp/report-capture-test"
  })
  console.log("done")
})
'
ls -la /tmp/report-capture-test
```

Expected: prints `done`, and `ls` shows both `01-tunnel-umami.png` and `02-metriques-umami.png` with non-trivial file sizes (open them to confirm they show the real dashboard, not a login error page).

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-report/lib/umami-capture.mjs
git commit -m "feat: add Umami screenshot capture for the report generator"
```

---

### Task 5: GlitchTip screenshot + performance-number capture

**Files:**
- Create: `scripts/generate-report/lib/glitchtip-capture.mjs`

**Interfaces:**
- Produces: `captureGlitchtipScreenshots({host, email, password, orgSlug, outDir}): Promise<{checkoutDurationMs: number|null, checkoutSuccessDurationMs: number|null}>`, writing `03-erreur-glitchtip.png` and `04-performance-glitchtip.png` into `outDir`, and returning the two parsed average-duration numbers (or `null` if a transaction group isn't present yet). Consumed by Task 7 (orchestrator), which forwards the returned numbers to Task 6's token substitution.

- [ ] **Step 1: Create `scripts/generate-report/lib/glitchtip-capture.mjs`**

```js
import { chromium } from 'playwright'

function parseDurationMs(rowText) {
  // e.g. "417.27ms" -> 417.27
  const match = rowText.match(/([\d.]+)\s*ms/)
  return match ? Number(match[1]) : null
}

export async function captureGlitchtipScreenshots({ host, email, password, orgSlug, outDir }) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } })

    await page.goto(`${host}/login`)
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', password)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1500)

    await page.goto(`${host}/${orgSlug}/issues`)
    await page.fill('input[type=search]', 'TypeError')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1200)
    await page.click('text=TypeError')
    await page.waitForTimeout(2000)
    await page.locator('mat-sidenav-content').screenshot({ path: `${outDir}/03-erreur-glitchtip.png` })

    await page.goto(`${host}/${orgSlug}/performance/transaction-groups`)
    await page.waitForTimeout(2000)
    await page.locator('mat-sidenav-content').screenshot({ path: `${outDir}/04-performance-glitchtip.png` })

    const rows = await page.evaluate(() => document.body.innerText)
    const lines = rows.split('\n')
    const checkoutIndex = lines.findIndex((l) => l.trim() === '/checkout ; navigation')
    const checkoutSuccessIndex = lines.findIndex((l) => l.trim() === '/checkout/success ; navigation')
    const checkoutDurationMs = checkoutIndex >= 0 ? parseDurationMs(lines.slice(checkoutIndex, checkoutIndex + 5).join(' ')) : null
    const checkoutSuccessDurationMs =
      checkoutSuccessIndex >= 0 ? parseDurationMs(lines.slice(checkoutSuccessIndex, checkoutSuccessIndex + 5).join(' ')) : null

    await browser.close()
    return { checkoutDurationMs, checkoutSuccessDurationMs }
  } catch (err) {
    await browser.close()
    throw err
  }
}
```

- [ ] **Step 2: Verify live against the running stack, including the parsed numbers**

```bash
cd scripts/generate-report
node --env-file=../../.env -e '
import("./lib/glitchtip-capture.mjs").then(async (m) => {
  const result = await m.captureGlitchtipScreenshots({
    host: process.env.GLITCHTIP_HOST ?? "http://glitchtip.localhost",
    email: process.env.GLITCHTIP_EMAIL,
    password: process.env.GLITCHTIP_PASSWORD,
    orgSlug: "eshop-monitor-web",
    outDir: "/tmp/report-capture-test"
  })
  console.log(result)
})
'
ls -la /tmp/report-capture-test/03-erreur-glitchtip.png /tmp/report-capture-test/04-performance-glitchtip.png
```

Expected: prints `{ checkoutDurationMs: <number>, checkoutSuccessDurationMs: <number> }` with real positive millisecond values, and both PNG files exist. Open `03-erreur-glitchtip.png` to confirm it shows the TypeError with its stack trace and the Browser/OS/Device info (fixed in the `sendDefaultPii`/header commit earlier).

**Note:** the duration-extraction logic is verified exactly against `document.body.innerText`'s real output during planning — each transaction group renders as three consecutive lines: `"/checkout ; navigation"`, `"eshop —"`, `"\t353.71ms"` (tab-prefixed). `lines.slice(checkoutIndex, checkoutIndex + 5).join(' ')` deliberately over-grabs (3 needed, 5 taken) as cheap margin against minor future layout changes; `parseDurationMs`'s regex matches the tab-prefixed `Xms` value either way. The screenshot itself is captured regardless of whether parsing succeeds; the parsed number is a bonus the orchestrator (Task 7) treats as optional (see its error handling) in case GlitchTip's layout ever changes.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-report/lib/glitchtip-capture.mjs
git commit -m "feat: add GlitchTip screenshot capture and performance-number parsing"
```

---

### Task 6: Report renderer (token substitution + PDF)

**Files:**
- Create: `scripts/generate-report/lib/render-pdf.mjs`

**Interfaces:**
- Consumes: token names from Task 1's template.
- Produces: `fillTemplate(markdown, values): string` (pure token substitution, exported for direct unit testing even though `renderPdf` also calls it internally), `renderPdf(markdownPath, outputPdfPath, values): Promise<void>` (reads the template, fills it, converts to PDF — the orchestrator's only call into this module). Consumed by Task 7 (orchestrator), which calls `renderPdf(TEMPLATE_PATH, OUTPUT_PDF_PATH, values)` directly with the numbers it computed.

- [ ] **Step 1: Create `scripts/generate-report/lib/render-pdf.mjs`**

```js
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { marked } from 'marked'
import { chromium } from 'playwright'

export function fillTemplate(markdown, values) {
  let filled = markdown
  for (const [token, value] of Object.entries(values)) {
    filled = filled.replaceAll(`{{${token}}}`, String(value))
  }
  return filled
}

const PDF_STYLES = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 800px; margin: 2rem auto; line-height: 1.5; color: #1a1a1a; }
  img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; margin: 0.5rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #333; padding-bottom: 0.3rem; }
  h2 { font-size: 1.3rem; margin-top: 2rem; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
`

export async function renderPdf(markdownPath, outputPdfPath, values) {
  const raw = await readFile(markdownPath, 'utf-8')
  const filled = fillTemplate(raw, values)
  const baseDir = path.dirname(markdownPath)

  const withAbsoluteImages = filled.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (src.startsWith('http') || src.startsWith('file://')) return match
    const absolute = path.resolve(baseDir, src)
    return `![${alt}](file://${absolute})`
  })

  const html = marked.parse(withAbsoluteImages)
  const styledHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${html}</body></html>`

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'eshop-report-'))
  const tmpHtmlPath = path.join(tmpDir, 'report.html')
  await writeFile(tmpHtmlPath, styledHtml, 'utf-8')

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle' })
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    })
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Verify live with placeholder values against the real template**

```bash
cd scripts/generate-report
node --env-file=../../.env -e '
import("./lib/render-pdf.mjs").then(async (m) => {
  await m.renderPdf(
    "../../docs/rapport-observabilite.md",
    "/tmp/report-capture-test/test-report.pdf",
    {
      TOTAL_VISITS: 67, CHECKOUT_SUCCESS_COUNT: 8, CONVERSION_RATE: "11.9",
      VIEW_PRODUCT_COUNT: 67, VIEW_PRODUCT_RATE: 100, ADD_TO_CART_COUNT: 44, ADD_TO_CART_RATE: "65.7",
      CHECKOUT_START_COUNT: 32, CHECKOUT_START_RATE: "72.7", CHECKOUT_SUCCESS_RATE: 25,
      HIGHEST_DROPOFF_STEP: "checkout_success", UNIQUE_VISITORS: 67, PAGEVIEWS: 333,
      AVG_SESSION_DURATION: "8s", BOUNCE_RATE: "43.3", AVG_CART_VALUE: "44.70",
      UTM_BREAKDOWN: "newsletter: 3, direct: 5", CHECKOUT_DURATION_MS: 417, CHECKOUT_SUCCESS_DURATION_MS: 320
    }
  )
  console.log("done")
})
'
ls -la /tmp/report-capture-test/test-report.pdf
```

Expected: prints `done`, PDF file exists with a non-trivial size (a few hundred KB, since it embeds the screenshots captured by Tasks 4/5 if `/tmp/report-capture-test` already has them — otherwise the `![...]()` images will just render as broken-image icons, which is fine for this isolated test). Open the PDF to confirm the numbers were substituted correctly and no `{{TOKEN}}` markers remain visible anywhere.

```bash
grep -c '{{' /tmp/report-capture-test/test-report.pdf || echo "0 (PDF is binary — this grep is expected to find nothing or error; the real check is opening the file)"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-report/lib/render-pdf.mjs
git commit -m "feat: add report renderer (token substitution, markdown to PDF via Playwright)"
```

---

### Task 7: Orchestrator, config, and README

**Files:**
- Create: `scripts/generate-report/generate-report.mjs`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 2–6.

- [ ] **Step 1: Create `scripts/generate-report/generate-report.mjs`**

```js
import { login, fetchStats, fetchEventCounts, fetchEventRecords } from './lib/umami-client.mjs'
import { captureUmamiScreenshots } from './lib/umami-capture.mjs'
import { captureGlitchtipScreenshots } from './lib/glitchtip-capture.mjs'
import { renderPdf } from './lib/render-pdf.mjs'
import {
  computeBounceRate,
  computeConversionRate,
  computeFunnelSteps,
  findHighestDropoffStep,
  computeAverageCartValue,
  computeUtmBreakdown
} from './lib/metrics.mjs'

const DAYS = Number(process.argv[2] ?? 7)
const NOW = Date.now()
const START = NOW - DAYS * 24 * 60 * 60 * 1000

const UMAMI_HOST = process.env.NUXT_PUBLIC_UMAMI_HOST
const UMAMI_WEBSITE_ID = process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID
const GLITCHTIP_HOST = process.env.GLITCHTIP_HOST ?? 'http://glitchtip.localhost'
const GLITCHTIP_ORG_SLUG = 'eshop-monitor-web'
const SCREENSHOTS_DIR = new URL('../../docs/screenshots', import.meta.url).pathname
const TEMPLATE_PATH = new URL('../../docs/rapport-observabilite.md', import.meta.url).pathname
const OUTPUT_PDF_PATH = new URL('../../docs/rapport-observabilite.pdf', import.meta.url).pathname

function round1(n) {
  return Math.round(n * 10) / 10
}

async function main() {
  const values = {}
  let hadFailure = false

  try {
    console.log('Fetching Umami numbers...')
    const token = await login(UMAMI_HOST, process.env.UMAMI_ADMIN_USERNAME, process.env.UMAMI_ADMIN_PASSWORD)
    const stats = await fetchStats(UMAMI_HOST, token, UMAMI_WEBSITE_ID, START, NOW)
    const eventCounts = await fetchEventCounts(UMAMI_HOST, token, UMAMI_WEBSITE_ID, START, NOW)
    const checkoutSuccessRecords = await fetchEventRecords(UMAMI_HOST, token, UMAMI_WEBSITE_ID, 'checkout_success', START, NOW)

    const funnelSteps = computeFunnelSteps(stats.visits, eventCounts)
    const [, viewProduct, addToCart, checkoutStart, checkoutSuccess] = funnelSteps

    values.TOTAL_VISITS = stats.visits
    values.CHECKOUT_SUCCESS_COUNT = eventCounts.checkout_success ?? 0
    values.CONVERSION_RATE = round1(computeConversionRate(eventCounts.checkout_success ?? 0, stats.visits))
    values.VIEW_PRODUCT_COUNT = viewProduct.count
    values.VIEW_PRODUCT_RATE = round1(viewProduct.passRate)
    values.ADD_TO_CART_COUNT = addToCart.count
    values.ADD_TO_CART_RATE = round1(addToCart.passRate)
    values.CHECKOUT_START_COUNT = checkoutStart.count
    values.CHECKOUT_START_RATE = round1(checkoutStart.passRate)
    values.CHECKOUT_SUCCESS_RATE = round1(checkoutSuccess.passRate)
    values.HIGHEST_DROPOFF_STEP = findHighestDropoffStep(funnelSteps)
    values.UNIQUE_VISITORS = stats.visitors
    values.PAGEVIEWS = stats.pageviews
    values.AVG_SESSION_DURATION = `${Math.round(stats.totaltime / Math.max(stats.visits, 1))}s`
    values.BOUNCE_RATE = round1(computeBounceRate(stats))
    values.AVG_CART_VALUE = computeAverageCartValue(checkoutSuccessRecords).toFixed(2)
    const utmBreakdown = computeUtmBreakdown(checkoutSuccessRecords)
    values.UTM_BREAKDOWN = Object.entries(utmBreakdown)
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ')
  } catch (err) {
    console.error('Umami numbers failed, leaving those placeholders untouched:', err.message)
    hadFailure = true
  }

  try {
    console.log('Capturing Umami screenshots...')
    await captureUmamiScreenshots({
      host: UMAMI_HOST,
      username: process.env.UMAMI_ADMIN_USERNAME,
      password: process.env.UMAMI_ADMIN_PASSWORD,
      websiteId: UMAMI_WEBSITE_ID,
      outDir: SCREENSHOTS_DIR
    })
  } catch (err) {
    console.error('Umami screenshots failed:', err.message)
    hadFailure = true
  }

  try {
    console.log('Capturing GlitchTip screenshots...')
    const perf = await captureGlitchtipScreenshots({
      host: GLITCHTIP_HOST,
      email: process.env.GLITCHTIP_EMAIL,
      password: process.env.GLITCHTIP_PASSWORD,
      orgSlug: GLITCHTIP_ORG_SLUG,
      outDir: SCREENSHOTS_DIR
    })
    if (perf.checkoutDurationMs !== null) values.CHECKOUT_DURATION_MS = round1(perf.checkoutDurationMs)
    if (perf.checkoutSuccessDurationMs !== null) values.CHECKOUT_SUCCESS_DURATION_MS = round1(perf.checkoutSuccessDurationMs)
  } catch (err) {
    console.error('GlitchTip screenshots failed:', err.message)
    hadFailure = true
  }

  console.log('Rendering PDF...')
  await renderPdf(TEMPLATE_PATH, OUTPUT_PDF_PATH, values)

  console.log(`Done: ${OUTPUT_PDF_PATH}${hadFailure ? ' (one or more sections failed — see errors above, re-run once fixed)' : ''}`)
}

main()
```

- [ ] **Step 2: Append the new config variables to `.env.example`**

```dotenv

# --- Umami admin (used by scripts/generate-report to log in and screenshot) ---
UMAMI_ADMIN_USERNAME=admin
UMAMI_ADMIN_PASSWORD=change_me_after_first_login

# --- GlitchTip report-bot (dedicated service account for scripts/generate-report) ---
GLITCHTIP_HOST=http://glitchtip.localhost
GLITCHTIP_EMAIL=
GLITCHTIP_PASSWORD=
```

- [ ] **Step 3: Add a "Générer le rapport automatiquement" section to `README.md`**

Insert after the existing "Générer du trafic de démonstration" section:

```markdown
## Générer le rapport d'observabilité automatiquement

Une fois la stack lancée et du trafic de démo généré (`scripts/demo-traffic`), un script se connecte à Umami et GlitchTip, prend les captures d'écran requises, calcule les vrais chiffres (taux de rebond, conversion, panier moyen, etc.) et produit `docs/rapport-observabilite.pdf`.

**Configuration préalable (une fois) :**
1. Dans `.env`, renseigner `UMAMI_ADMIN_USERNAME`/`UMAMI_ADMIN_PASSWORD` (les identifiants admin Umami) et `GLITCHTIP_EMAIL`/`GLITCHTIP_PASSWORD` (un compte GlitchTip membre de l'organisation — un compte de service dédié est recommandé plutôt que votre compte personnel : créez-en un via `/register`, puis invitez-le dans **Organization → Members** depuis votre compte).
2. Créer une fois le rapport "Funnel" dans Umami : site → **Funnels** → **+ Funnel** → nommer (ex. "Tunnel d'achat"), garder la fenêtre par défaut (60 min), ajouter 4 étapes de type **Triggered event** avec `view_product`, `add_to_cart`, `checkout_start`, `checkout_success` dans l'ordre, **Save**. Ce rapport persiste ensuite pour toutes les générations futures.

**Lancer :**

```bash
cd scripts/generate-report
npm install
npm start        # 7 derniers jours par défaut
npm start 30      # ou une fenêtre personnalisée, en jours
```

Chaque section (chiffres Umami, captures Umami, captures GlitchTip) échoue indépendamment sans bloquer les autres — si une section échoue, le PDF est quand même généré avec les placeholders restants inchangés pour cette section, et l'erreur précise s'affiche dans le terminal.
```

- [ ] **Step 4: Full live verification of the complete pipeline**

```bash
cd scripts/generate-report
npm start 7
```

Expected: the four log lines ("Fetching Umami numbers...", "Capturing Umami screenshots...", "Capturing GlitchTip screenshots...", "Rendering PDF...") each complete without a caught error, ending with `Done: .../docs/rapport-observabilite.pdf` (no "one or more sections failed" suffix). Open the resulting PDF and confirm: all four screenshots are present and legible, every `{{TOKEN}}` has been replaced with a real number, and the numbers are plausible (visits/conversion rate/bounce rate roughly match what was seen live during planning).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-report/generate-report.mjs .env.example README.md
git commit -m "feat: add report generator orchestrator, config, and README instructions"
```
