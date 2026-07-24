import { fileURLToPath } from 'node:url'
import {
  computeAverageCartValue,
  computeBounceRate,
  computeConversionRate,
  computeFunnelSteps,
  computeUtmBreakdown,
  findHighestDropoffStep
} from './lib/metrics.mjs'
import { captureGlitchtipScreenshots } from './lib/glitchtip-capture.mjs'
import { renderPdf } from './lib/render-pdf.mjs'
import { captureUmamiScreenshots } from './lib/umami-capture.mjs'
import { fetchEventCounts, fetchEventRecords, fetchStats, login } from './lib/umami-client.mjs'

const days = Number(process.argv[2] ?? 7)
const now = Date.now()
const start = now - days * 24 * 60 * 60 * 1000

const glitchtipHost = process.env.GLITCHTIP_HOST ?? 'http://glitchtip.localhost'
const glitchtipOrgSlug = process.env.GLITCHTIP_ORG_SLUG ?? 'eshop-monitor-web'

const screenshotsDir = fileURLToPath(new URL('../../docs/screenshots', import.meta.url))
const templatePath = fileURLToPath(new URL('../../docs/rapport-observabilite.md', import.meta.url))
const outputPdfPath = fileURLToPath(new URL('../../docs/rapport-observabilite.pdf', import.meta.url))

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function formatAverageSessionDuration(totalTime, visits) {
  const seconds = Math.round(totalTime / Math.max(visits, 1))
  if (seconds < 60) return `${seconds} s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes} min ${remainingSeconds} s`
}

function formatUtmBreakdown(records) {
  const breakdown = computeUtmBreakdown(records)
  const entries = Object.entries(breakdown)

  if (entries.length === 0) return 'aucun checkout_success'

  return entries
    .sort(([sourceA], [sourceB]) => sourceA.localeCompare(sourceB))
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ')
}

function getUmamiDateRangeLabel(dayCount) {
  if (dayCount <= 1) return 'Last 24 hours'
  if (dayCount === 7) return 'Last 7 days'
  if (dayCount === 30) return 'Last 30 days'
  return null
}

async function collectUmamiValues(values) {
  const host = requiredEnv('NUXT_PUBLIC_UMAMI_HOST')
  const websiteId = requiredEnv('NUXT_PUBLIC_UMAMI_WEBSITE_ID')
  const username = requiredEnv('UMAMI_ADMIN_USERNAME')
  const password = requiredEnv('UMAMI_ADMIN_PASSWORD')

  const token = await login(host, username, password)
  const stats = await fetchStats(host, token, websiteId, start, now)
  const eventCounts = await fetchEventCounts(host, token, websiteId, start, now)
  const checkoutSuccessRecords = await fetchEventRecords(
    host,
    token,
    websiteId,
    'checkout_success',
    start,
    now
  )

  const checkoutSuccessCount = eventCounts.checkout_success ?? 0
  const funnelSteps = computeFunnelSteps(stats.visits, eventCounts)
  const [, viewProduct, addToCart, checkoutStart, checkoutSuccess] = funnelSteps

  values.TOTAL_VISITS = stats.visits
  values.CHECKOUT_SUCCESS_COUNT = checkoutSuccessCount
  values.CONVERSION_RATE = round1(computeConversionRate(checkoutSuccessCount, stats.visits))
  values.VIEW_PRODUCT_COUNT = viewProduct.count
  values.VIEW_PRODUCT_RATE = round1(viewProduct.passRate)
  values.ADD_TO_CART_COUNT = addToCart.count
  values.ADD_TO_CART_RATE = round1(addToCart.passRate)
  values.CHECKOUT_START_COUNT = checkoutStart.count
  values.CHECKOUT_START_RATE = round1(checkoutStart.passRate)
  values.CHECKOUT_SUCCESS_RATE = round1(checkoutSuccess.passRate)
  values.HIGHEST_DROPOFF_STEP = findHighestDropoffStep(funnelSteps) ?? 'indisponible'
  values.UNIQUE_VISITORS = stats.visitors
  values.PAGEVIEWS = stats.pageviews
  values.AVG_SESSION_DURATION = formatAverageSessionDuration(stats.totaltime, stats.visits)
  values.BOUNCE_RATE = round1(computeBounceRate(stats))
  values.AVG_CART_VALUE = computeAverageCartValue(checkoutSuccessRecords).toFixed(2)
  values.UTM_BREAKDOWN = formatUtmBreakdown(checkoutSuccessRecords)
}

async function captureUmami() {
  await captureUmamiScreenshots({
    host: requiredEnv('NUXT_PUBLIC_UMAMI_HOST'),
    username: requiredEnv('UMAMI_ADMIN_USERNAME'),
    password: requiredEnv('UMAMI_ADMIN_PASSWORD'),
    websiteId: requiredEnv('NUXT_PUBLIC_UMAMI_WEBSITE_ID'),
    outDir: screenshotsDir,
    dateRangeLabel: getUmamiDateRangeLabel(days)
  })
}

async function captureGlitchtip(values) {
  const perf = await captureGlitchtipScreenshots({
    host: glitchtipHost,
    email: requiredEnv('GLITCHTIP_EMAIL'),
    password: requiredEnv('GLITCHTIP_PASSWORD'),
    orgSlug: glitchtipOrgSlug,
    outDir: screenshotsDir
  })

  if (perf.checkoutDurationMs !== null) {
    values.CHECKOUT_DURATION_MS = round1(perf.checkoutDurationMs)
  }

  if (perf.checkoutSuccessDurationMs !== null) {
    values.CHECKOUT_SUCCESS_DURATION_MS = round1(perf.checkoutSuccessDurationMs)
  }
}

async function runStep(label, task) {
  try {
    console.log(`${label}...`)
    await task()
    return false
  } catch (err) {
    console.error(`${label} failed; keeping affected placeholders unchanged: ${err.message}`)
    return true
  }
}

async function main() {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('Usage: npm start [days], where days is a positive number')
  }

  const values = {}
  let hadFailure = false

  hadFailure = (await runStep('Fetching Umami numbers', () => collectUmamiValues(values))) || hadFailure
  hadFailure = (await runStep('Capturing Umami screenshots', captureUmami)) || hadFailure
  hadFailure = (await runStep('Capturing GlitchTip screenshots', () => captureGlitchtip(values))) || hadFailure

  console.log('Rendering PDF...')
  await renderPdf(templatePath, outputPdfPath, values)

  const suffix = hadFailure ? ' (one or more sections failed; see logs above)' : ''
  console.log(`Done: ${outputPdfPath}${suffix}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
