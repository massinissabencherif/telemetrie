import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function parseDurationMs(rowText) {
  const match = rowText.match(/([\d.]+)\s*(ms|s)\b/i)
  if (!match) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null

  return match[2].toLowerCase() === 's' ? value * 1000 : value
}

function normalizeUiText(value) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

async function screenshotMainContent(page, path) {
  const mainContent = page.locator('mat-sidenav-content')

  if ((await mainContent.count()) > 0) {
    await mainContent.first().screenshot({ path })
    return
  }

  await page.screenshot({ path, fullPage: true })
}

async function loginToGlitchtip(page, host, email, password) {
  const baseUrl = trimTrailingSlash(host)

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)

  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10000 }),
    page.getByText('Log in').click()
  ])
}

function findDurationForTransaction(lines, transactionName) {
  const expectedName = normalizeUiText(transactionName)
  const index = lines.findIndex((line) => normalizeUiText(line) === expectedName)
  if (index < 0) return null

  return parseDurationMs(lines.slice(index, index + 6).join(' '))
}

export async function captureGlitchtipScreenshots({ host, email, password, orgSlug, outDir }) {
  await mkdir(outDir, { recursive: true })

  const baseUrl = trimTrailingSlash(host)
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } })

    await loginToGlitchtip(page, baseUrl, email, password)

    await page.goto(`${baseUrl}/${orgSlug}/issues`, { waitUntil: 'networkidle' })
    await page.fill('input[type=search]', 'TypeError')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1200)

    const issueLink = page.locator('a', { hasText: /TypeError|gateway de paiement/i }).first()
    if ((await issueLink.count()) === 0) {
      throw new Error('GlitchTip issue not found for search term "TypeError"')
    }

    await issueLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await screenshotMainContent(page, `${outDir}/03-erreur-glitchtip.png`)

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseUrl}/${orgSlug}/performance/transaction-groups`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await screenshotMainContent(page, `${outDir}/04-performance-glitchtip.png`)

    const lines = (await page.locator('body').innerText()).split('\n')

    return {
      checkoutDurationMs: findDurationForTransaction(lines, '/checkout ; navigation'),
      checkoutSuccessDurationMs: findDurationForTransaction(lines, '/checkout/success ; navigation')
    }
  } finally {
    await browser.close()
  }
}
