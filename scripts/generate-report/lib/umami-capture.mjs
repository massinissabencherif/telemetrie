import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const FUNNEL_EVENTS = ['view_product', 'add_to_cart', 'checkout_start', 'checkout_success']

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

async function loginToUmami(page, host, username, password) {
  const baseUrl = trimTrailingSlash(host)

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name=username]', username)
  await page.fill('input[name=password]', password)

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10000 }),
    page.click('button[type=submit]')
  ])
}

async function selectDateRange(page, dateRangeLabel) {
  if (!dateRangeLabel) return

  const rangeButton = page
    .getByRole('button', { name: /Last 24 hours|Last 7 days|Last 30 days|Today|This week/i })
    .last()

  if ((await rangeButton.count()) === 0) return

  await rangeButton.click()

  const option = page.getByText(dateRangeLabel, { exact: true }).last()
  await option.waitFor({ state: 'visible', timeout: 3000 })
  await option.click()
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1000)
}

export async function captureUmamiScreenshots({ host, username, password, websiteId, outDir, dateRangeLabel }) {
  await mkdir(outDir, { recursive: true })

  const baseUrl = trimTrailingSlash(host)
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    await loginToUmami(page, baseUrl, username, password)

    await page.goto(`${baseUrl}/websites/${websiteId}`, { waitUntil: 'networkidle' })
    await selectDateRange(page, dateRangeLabel)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${outDir}/02-metriques-umami.png`, fullPage: true })

    await page.goto(`${baseUrl}/websites/${websiteId}/funnels`, { waitUntil: 'networkidle' })
    await selectDateRange(page, dateRangeLabel)
    await page.waitForTimeout(1000)
    const funnelText = await page.locator('body').innerText()
    const hasConfiguredFunnel = FUNNEL_EVENTS.every((eventName) => funnelText.includes(eventName))

    if (!hasConfiguredFunnel) {
      await page.goto(`${baseUrl}/websites/${websiteId}/events`, { waitUntil: 'networkidle' })
      await selectDateRange(page, dateRangeLabel)
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: `${outDir}/01-tunnel-umami.png`, fullPage: true })
  } finally {
    await browser.close()
  }
}
