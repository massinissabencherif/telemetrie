import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://shop.localhost'
const JOURNEY_COUNT = Number(process.argv[2] ?? 30)
const UTM_SOURCES = ['newsletter', 'google-ads', 'facebook', null, null]

// Playwright's default headless Chromium reports "HeadlessChrome" in its user agent,
// which Umami's bot filter treats as a bot: it accepts the request (200 OK) but
// silently discards it (responds { beep: 'boop' }) instead of recording a visit.
// Regular-looking desktop UAs avoid that filter so events actually count. Umami
// also derives its visitor/session id from a hash of IP + user agent, and every
// journey here shares the same local IP — so each journey gets a freshly
// generated, high-cardinality UA (random OS x random Chrome build) instead of a
// small fixed pool, otherwise journeys sharing a UA would merge into one long
// session and the bounce rate would read as artificially 0.
const DESKTOP_OS_STRINGS = [
  'Macintosh; Intel Mac OS X 10_15_7',
  'Macintosh; Intel Mac OS X 13_2_1',
  'Windows NT 10.0; Win64; x64',
  'Windows NT 11.0; Win64; x64',
  'X11; Linux x86_64'
]

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function randomUserAgent() {
  const os = pick(DESKTOP_OS_STRINGS)
  const major = 140 + Math.floor(Math.random() * 12)
  const build = 1000 + Math.floor(Math.random() * 8999)
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.100 Safari/537.36`
}

function proceeds(probability) {
  return Math.random() < probability
}

async function runJourney(browser, index) {
  const context = await browser.newContext({ userAgent: randomUserAgent() })
  const page = await context.newPage()
  const utmSource = pick(UTM_SOURCES)
  const landingUrl = utmSource ? `${BASE_URL}/?utm_source=${utmSource}` : `${BASE_URL}/`

  await page.goto(landingUrl)
  await page.waitForTimeout(300)

  if (!proceeds(0.7)) {
    console.log(`[${index}] bounced on the homepage (utm_source=${utmSource ?? 'direct'})`)
    await context.close()
    return
  }

  await page.getByTestId('cta-view-products').click()
  await page.waitForTimeout(300)

  if (!proceeds(0.7)) {
    console.log(`[${index}] left after browsing the product list`)
    await context.close()
    return
  }

  const productLinks = await page.getByTestId('product-link').all()
  await pick(productLinks).click()
  await page.waitForTimeout(300)

  if (!proceeds(0.55)) {
    console.log(`[${index}] viewed a product but did not add it to cart`)
    await context.close()
    return
  }

  await page.getByTestId('add-to-cart').click()
  await page.waitForTimeout(200)

  if (!proceeds(0.75)) {
    console.log(`[${index}] added to cart but abandoned before checkout`)
    await context.close()
    return
  }

  await page.click('a[href="/cart"]')
  await page.getByTestId('go-to-checkout').click()
  await page.waitForTimeout(300)
  await page.getByTestId('address-input').fill('12 rue des Artisans, 69000 Lyon')

  let paid = false
  for (let attempt = 0; attempt < 3 && !paid; attempt++) {
    await page.getByTestId('pay-button').click()
    await page.waitForTimeout(500)
    paid = page.url().includes('/checkout/success')
    if (!paid) {
      console.log(`[${index}] payment attempt ${attempt + 1} failed, retrying`)
    }
  }

  console.log(paid ? `[${index}] completed checkout` : `[${index}] gave up after repeated payment failures`)
  await context.close()
}

async function main() {
  const browser = await chromium.launch()
  for (let i = 1; i <= JOURNEY_COUNT; i++) {
    await runJourney(browser, i)
  }
  await browser.close()
  console.log(`Done: ${JOURNEY_COUNT} simulated journeys against ${BASE_URL}`)
}

main()
