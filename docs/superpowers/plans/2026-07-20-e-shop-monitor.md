# E-Shop Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Eco-Hardware", a self-hosted, Docker-Composed e-commerce demo (Nuxt 4) instrumented end-to-end with GlitchTip (error + performance telemetry) and Umami (cookieless product analytics + purchase-funnel tracking), matching every requirement in `Sujet.md`.

**Architecture:** Three containerized subsystems sit behind a single Traefik reverse proxy on host-only `.localhost` domains: (1) a Nuxt 4 SSR app simulating a hardware e-shop (home → products → product detail → cart → checkout → confirmation), (2) GlitchTip (Postgres + Redis + all-in-one GlitchTip container) capturing unhandled JS errors and a deliberately flaky payment button, (3) Umami (Postgres + Umami container) capturing standard traffic metrics plus four custom funnel events (`view_product`, `add_to_cart`, `checkout_start`, `checkout_success`) with business properties (price, utm_source). Each backing database sits on its own private Docker network; only the three user-facing services are attached to the shared `proxy` network Traefik routes into.

**Tech Stack:** Nuxt 4.5 (Vue 3.5), TypeScript 7, Vitest 4 + happy-dom for unit tests, @sentry/vue 10 (GlitchTip is Sentry-protocol compatible), Umami tracker script, Docker Compose, Traefik v3.3, PostgreSQL 16, Redis 7, Playwright 1.61 (demo traffic generator only, not app runtime).

## Global Constraints

- All services MUST be orchestrated through `compose.yml` + `.env` (`.env.example` committed, real `.env` gitignored) and start with a single `docker compose up` — per Sujet.md §5.
- Architecture MUST match Sujet.md §3 exactly: Node web service + reverse proxy; GlitchTip = 1 Postgres + 1 Redis + 1 GlitchTip service; Analytics = 1 Postgres + 1 Umami service.
- Persistent named volumes are REQUIRED for both Postgres databases and GlitchTip uploads (grading criterion "volumes persistants configurés").
- The frontend MUST auto-capture unhandled JS exceptions (no manual try/catch needed for that requirement) — the SDK init alone satisfies it.
- The payment button MUST fail with a `TypeError` or a rejected promise roughly 1 time in 3.
- The checkout page load MUST be measured for performance (GlitchTip performance tracking).
- The four funnel events (`view_product`, `add_to_cart`, `checkout_start`, `checkout_success`) MUST fire at the exact points described in Sujet.md §4.3.B, with `checkout_success` carrying the cart's monetary value as an event property.
- Traffic origin (`utm_source` / `ref`) MUST be captured and attached to funnel events.
- RGPD: no PII (name, address, email) may ever be sent to GlitchTip or Umami. Umami is cookieless by design; GlitchTip must run with `sendDefaultPii: false` and a `beforeSend` scrub.
- No unnecessary dependencies: no Pinia (a module-scoped `ref` composable is enough for a single-user demo cart), no test framework beyond Vitest, no UI kit.

---

## File Structure

```
analytique/
├── compose.yml
├── .env.example
├── .gitignore
├── README.md
├── docs/
│   ├── superpowers/plans/2026-07-20-e-shop-monitor.md   (this file)
│   └── rapport-observabilite.md                          (report template, Task 17)
├── web/                                                   (Nuxt 4 app)
│   ├── Dockerfile
│   ├── package.json
│   ├── nuxt.config.ts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .gitignore
│   ├── app/
│   │   ├── app.vue
│   │   ├── data/products.ts
│   │   ├── composables/useCart.ts
│   │   ├── composables/useAnalytics.ts
│   │   ├── utils/payment.ts
│   │   ├── utils/utm.ts
│   │   ├── plugins/sentry.client.ts
│   │   ├── plugins/umami.client.ts
│   │   └── pages/
│   │       ├── index.vue
│   │       ├── products/index.vue
│   │       ├── products/[id].vue
│   │       ├── cart.vue
│   │       ├── checkout.vue
│   │       └── checkout/success.vue
│   └── tests/
│       ├── useCart.test.ts
│       ├── useAnalytics.test.ts
│       ├── payment.test.ts
│       └── utm.test.ts
└── scripts/demo-traffic/
    ├── package.json
    └── generate-demo-traffic.mjs
```

---

### Task 1: Repository & Nuxt 4 app scaffolding

**Files:**
- Create: `.gitignore`
- Create: `web/package.json`
- Create: `web/nuxt.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/vitest.config.ts`
- Create: `web/.gitignore`
- Create: `web/app/app.vue`
- Create: `web/app/pages/index.vue`

**Interfaces:**
- Produces: Nuxt 4 `app/` source layout (`~` alias → `web/app/`), `npm run build` / `npm run test` scripts every later task relies on.

- [ ] **Step 1: Create the root `.gitignore`**

```gitignore
node_modules/
.env
.nuxt/
.output/
.DS_Store
dist/
```

- [ ] **Step 2: Create `web/package.json`**

```json
{
  "name": "eshop-monitor-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "test": "vitest run"
  },
  "dependencies": {
    "nuxt": "^4.5.0",
    "vue": "^3.5.40",
    "@sentry/vue": "^10.66.0"
  },
  "devDependencies": {
    "vitest": "^4.1.10",
    "happy-dom": "^20.11.0",
    "typescript": "^7.0.2"
  }
}
```

- [ ] **Step 3: Create `web/nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-07-20',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      glitchtipDsn: '',
      umamiHost: '',
      umamiWebsiteId: ''
    }
  }
})
```

`NUXT_PUBLIC_GLITCHTIP_DSN`, `NUXT_PUBLIC_UMAMI_HOST` and `NUXT_PUBLIC_UMAMI_WEBSITE_ID` environment variables automatically override these three keys at runtime (Nuxt's built-in `NUXT_PUBLIC_<KEY>` convention) — no manual `process.env` reads needed.

- [ ] **Step 4: Create `web/tsconfig.json`**

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 5: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **Step 6: Create `web/.gitignore`**

```gitignore
node_modules/
.nuxt/
.output/
dist/
.env
```

- [ ] **Step 7: Create `web/app/app.vue`**

```vue
<template>
  <div class="app-shell">
    <header class="nav">
      <NuxtLink to="/" class="brand">Eco-Hardware</NuxtLink>
      <nav>
        <NuxtLink to="/products">Produits</NuxtLink>
        <NuxtLink to="/cart">Panier ({{ cart.count.value }})</NuxtLink>
      </nav>
    </header>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
const cart = useCart()
</script>
```

This references `useCart()`, which does not exist yet — that is expected, it is implemented in Task 3. For this task only, temporarily stub it out so the app builds.

- [ ] **Step 8: Create a temporary placeholder home page `web/app/pages/index.vue`**

```vue
<template>
  <section>
    <h1>Eco-Hardware</h1>
    <p>Outillage professionnel reconditionné, livré rapidement.</p>
  </section>
</template>
```

- [ ] **Step 9: Temporarily stub `useCart` so the app builds before Task 3**

Create `web/app/composables/useCart.ts` with a minimal placeholder (Task 3 will replace this file entirely with the full TDD implementation):

```ts
import { ref, computed } from 'vue'

const items = ref<{ productId: string; name: string; price: number; quantity: number }[]>([])
const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

export function useCart() {
  return { items, count }
}
```

- [ ] **Step 10: Install dependencies and verify the app builds**

```bash
cd web && npm install && npm run build
```

Expected: exits 0, `.output/` directory created, no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git init
git add .gitignore web
git commit -m "chore: scaffold Nuxt 4 app skeleton"
```

---

### Task 2: Analytics event composable (TDD)

**Files:**
- Create: `web/app/composables/useAnalytics.ts`
- Test: `web/tests/useAnalytics.test.ts`

**Interfaces:**
- Produces: `trackEvent(name: string, props?: Record<string, unknown>): void` — used by Tasks 5, 7, 9 to fire `view_product`, `add_to_cart`, `checkout_start`, `checkout_success`.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/useAnalytics.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackEvent } from '../app/composables/useAnalytics'

describe('trackEvent', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup only
    delete window.umami
  })

  it('does nothing when window.umami is not defined (script blocked or not loaded yet)', () => {
    expect(() => trackEvent('view_product', { product_id: 'p1' })).not.toThrow()
  })

  it('forwards the event name and props to window.umami.track', () => {
    const track = vi.fn()
    // @ts-expect-error test setup only
    window.umami = { track }
    trackEvent('add_to_cart', { product_id: 'p1', price: 10 })
    expect(track).toHaveBeenCalledWith('add_to_cart', { product_id: 'p1', price: 10 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/useAnalytics.test.ts
```

Expected: FAIL — `../app/composables/useAnalytics` has no exported member `trackEvent`.

- [ ] **Step 3: Write the implementation**

```ts
// web/app/composables/useAnalytics.ts
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void
    }
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.umami) return
  window.umami.track(name, props)
}

export function useAnalytics() {
  return { trackEvent }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/useAnalytics.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/composables/useAnalytics.ts web/tests/useAnalytics.test.ts
git commit -m "feat: add trackEvent composable wrapping window.umami.track"
```

---

### Task 3: Cart composable (TDD)

**Files:**
- Modify: `web/app/composables/useCart.ts` (replaces the Task 1 stub)
- Test: `web/tests/useCart.test.ts`

**Interfaces:**
- Produces: `useCart(): { items: Ref<CartItem[]>, total: ComputedRef<number>, count: ComputedRef<number>, addItem(product: {id: string; name: string; price: number}): void, removeItem(productId: string): void, clear(): void }`. `CartItem = { productId: string; name: string; price: number; quantity: number }`. Used by Tasks 5 (product detail), 6 (cart page), 7 (checkout), 9 (checkout success).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/useCart.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCart } from '../app/composables/useCart'

describe('useCart', () => {
  beforeEach(() => {
    useCart().clear()
  })

  it('adds a new product with quantity 1', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 89.9 })
    expect(cart.items.value).toEqual([{ productId: 'p1', name: 'Perceuse', price: 89.9, quantity: 1 }])
  })

  it('increments quantity when adding the same product twice', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 89.9 })
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 89.9 })
    expect(cart.items.value[0].quantity).toBe(2)
  })

  it('computes the total price across items and quantities', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 10 })
    cart.addItem({ id: 'p2', name: 'Scie', price: 20 })
    expect(cart.total.value).toBe(30)
  })

  it('computes the total item count across quantities', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 10 })
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 10 })
    expect(cart.count.value).toBe(2)
  })

  it('removes a product by id', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 10 })
    cart.removeItem('p1')
    expect(cart.items.value).toEqual([])
  })

  it('clears all items', () => {
    const cart = useCart()
    cart.addItem({ id: 'p1', name: 'Perceuse', price: 10 })
    cart.clear()
    expect(cart.items.value).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/useCart.test.ts
```

Expected: FAIL — current stub has no `addItem`/`removeItem`/`clear`/`total`.

- [ ] **Step 3: Replace `web/app/composables/useCart.ts` with the full implementation**

```ts
import { ref, computed } from 'vue'

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

const items = ref<CartItem[]>([])

const total = computed(() => items.value.reduce((sum, item) => sum + item.price * item.quantity, 0))
const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

function addItem(product: { id: string; name: string; price: number }) {
  const existing = items.value.find((i) => i.productId === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    items.value.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 })
  }
}

function removeItem(productId: string) {
  items.value = items.value.filter((i) => i.productId !== productId)
}

function clear() {
  items.value = []
}

export function useCart() {
  return { items, total, count, addItem, removeItem, clear }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/useCart.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Verify the app still builds**

```bash
cd web && npm run build
```

Expected: exits 0 (`app.vue`'s `cart.count.value` reference now resolves against the real implementation).

- [ ] **Step 6: Commit**

```bash
git add web/app/composables/useCart.ts web/tests/useCart.test.ts
git commit -m "feat: implement cart composable with add/remove/clear/total"
```

---

### Task 4: Product catalog data + Home & product list pages

**Files:**
- Create: `web/app/data/products.ts`
- Modify: `web/app/pages/index.vue`
- Create: `web/app/pages/products/index.vue`
- Test: `web/tests/products.test.ts`

**Interfaces:**
- Produces: `Product = { id: string; name: string; price: number; description: string; emoji: string }`, `getProducts(): Product[]`, `getProductById(id: string): Product | undefined`. Used by Task 5 (product detail page) and the demo traffic script (Task 15, indirectly via rendered links).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/products.test.ts
import { describe, it, expect } from 'vitest'
import { getProducts, getProductById } from '../app/data/products'

describe('product catalog', () => {
  it('exposes at least four products with positive prices', () => {
    const products = getProducts()
    expect(products.length).toBeGreaterThanOrEqual(4)
    for (const product of products) {
      expect(product.price).toBeGreaterThan(0)
    }
  })

  it('finds a product by id', () => {
    const [first] = getProducts()
    expect(getProductById(first.id)).toEqual(first)
  })

  it('returns undefined for an unknown id', () => {
    expect(getProductById('does-not-exist')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/products.test.ts
```

Expected: FAIL — `web/app/data/products.ts` does not exist.

- [ ] **Step 3: Create `web/app/data/products.ts`**

```ts
export interface Product {
  id: string
  name: string
  price: number
  description: string
  emoji: string
}

export const products: Product[] = [
  { id: 'p1', name: 'Perceuse visseuse 18V', price: 89.9, description: 'Perceuse sans fil avec deux batteries et coffret de rangement.', emoji: '🔧' },
  { id: 'p2', name: 'Scie sauteuse 650W', price: 64.5, description: 'Scie sauteuse filaire, lame réglable, idéale pour le bois et le métal.', emoji: '🪚' },
  { id: 'p3', name: 'Établi pliable 150kg', price: 129.0, description: 'Établi robuste pliable, charge max 150kg, mors ajustables.', emoji: '🛠️' },
  { id: 'p4', name: 'Casque de protection auditive', price: 24.9, description: 'Casque anti-bruit SNR 27dB pour travaux bruyants.', emoji: '🎧' },
  { id: 'p5', name: 'Niveau à bulle 60cm', price: 18.3, description: 'Niveau aluminium 3 bulles, précision professionnelle.', emoji: '📏' },
  { id: 'p6', name: 'Kit tournevis de précision (32 pièces)', price: 15.9, description: 'Set complet pour électronique et petite maintenance.', emoji: '🪛' }
]

export function getProducts(): Product[] {
  return products
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/products.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Update the home page with a call to action, `web/app/pages/index.vue`**

```vue
<template>
  <section>
    <h1>Eco-Hardware</h1>
    <p>Outillage professionnel reconditionné, livré rapidement.</p>
    <NuxtLink to="/products" class="cta" data-testid="cta-view-products">Voir les produits</NuxtLink>
  </section>
</template>
```

- [ ] **Step 6: Create the product list page `web/app/pages/products/index.vue`**

```vue
<template>
  <section>
    <h1>Nos produits</h1>
    <ul class="product-grid">
      <li v-for="product in products" :key="product.id">
        <NuxtLink :to="`/products/${product.id}`" data-testid="product-link">
          <span>{{ product.emoji }}</span>
          <h2>{{ product.name }}</h2>
          <p>{{ product.price.toFixed(2) }} €</p>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { getProducts } from '~/data/products'

const products = getProducts()
</script>
```

- [ ] **Step 7: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add web/app/data web/app/pages/index.vue web/app/pages/products/index.vue web/tests/products.test.ts
git commit -m "feat: add product catalog and home/product-list pages"
```

---

### Task 5: Product detail page with view_product / add_to_cart tracking

**Files:**
- Create: `web/app/pages/products/[id].vue`

**Interfaces:**
- Consumes: `getProductById` (Task 4), `useCart().addItem` (Task 3), `trackEvent` (Task 2).

- [ ] **Step 1: Create `web/app/pages/products/[id].vue`**

```vue
<template>
  <section v-if="product">
    <h1>{{ product.emoji }} {{ product.name }}</h1>
    <p>{{ product.description }}</p>
    <p class="price">{{ product.price.toFixed(2) }} €</p>
    <button data-testid="add-to-cart" @click="handleAddToCart">Ajouter au panier</button>
  </section>
</template>

<script setup lang="ts">
import { getProductById } from '~/data/products'

const route = useRoute()
const product = getProductById(route.params.id as string)
const cart = useCart()
const { trackEvent } = useAnalytics()

if (!product) {
  throw createError({ statusCode: 404, statusMessage: 'Produit introuvable' })
}

onMounted(() => {
  trackEvent('view_product', { product_id: product.id, name: product.name, price: product.price })
})

function handleAddToCart() {
  cart.addItem(product)
  trackEvent('add_to_cart', { product_id: product.id, name: product.name, price: product.price })
}
</script>
```

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/pages/products/\[id\].vue
git commit -m "feat: add product detail page with view_product/add_to_cart tracking"
```

---

### Task 6: Cart page

**Files:**
- Create: `web/app/pages/cart.vue`

**Interfaces:**
- Consumes: `useCart()` (Task 3).

- [ ] **Step 1: Create `web/app/pages/cart.vue`**

```vue
<template>
  <section>
    <h1>Panier</h1>
    <p v-if="cart.items.value.length === 0">Votre panier est vide.</p>
    <ul v-else>
      <li v-for="item in cart.items.value" :key="item.productId">
        {{ item.name }} × {{ item.quantity }} — {{ (item.price * item.quantity).toFixed(2) }} €
        <button @click="cart.removeItem(item.productId)">Retirer</button>
      </li>
    </ul>
    <p class="total">Total : {{ cart.total.value.toFixed(2) }} €</p>
    <NuxtLink v-if="cart.items.value.length > 0" to="/checkout" class="cta" data-testid="go-to-checkout">
      Passer la commande
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
const cart = useCart()
</script>
```

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/pages/cart.vue
git commit -m "feat: add cart page"
```

---

### Task 7: Payment simulation utility (TDD)

**Files:**
- Create: `web/app/utils/payment.ts`
- Test: `web/tests/payment.test.ts`

**Interfaces:**
- Produces: `PaymentResult = { success: boolean; error?: Error }`, `simulatePayment(random?: () => number): PaymentResult`. Used by Task 8 (checkout page).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/payment.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/payment.test.ts
```

Expected: FAIL — `web/app/utils/payment.ts` does not exist.

- [ ] **Step 3: Create `web/app/utils/payment.ts`**

```ts
export interface PaymentResult {
  success: boolean
  error?: Error
}

export function simulatePayment(random: () => number = Math.random): PaymentResult {
  if (random() < 1 / 3) {
    if (random() < 0.5) {
      return {
        success: false,
        error: new TypeError("Impossible de lire la propriété 'status' de la réponse du gateway de paiement (undefined).")
      }
    }
    return {
      success: false,
      error: new Error('Le gateway de paiement a rejeté la transaction (timeout).')
    }
  }
  return { success: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/payment.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/payment.ts web/tests/payment.test.ts
git commit -m "feat: add pure payment simulation with 1/3 injected failure rate"
```

---

### Task 8: Traffic-source capture utility (TDD)

**Files:**
- Create: `web/app/utils/utm.ts`
- Test: `web/tests/utm.test.ts`

**Interfaces:**
- Produces: `TrafficSource = { utm_source: string | null; ref: string | null }`, `captureTrafficSource(search: string, referrer: string, storage?: Storage): TrafficSource`. Used by Task 9 (checkout success page).

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/utm.test.ts
import { describe, it, expect } from 'vitest'
import { captureTrafficSource } from '../app/utils/utm'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage
}

describe('captureTrafficSource', () => {
  it('extracts utm_source from the query string', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('?utm_source=newsletter', '', storage)
    expect(source.utm_source).toBe('newsletter')
  })

  it('falls back to the referrer hostname when there is no ref param', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('', 'https://www.google.com/search?q=perceuse', storage)
    expect(source.ref).toBe('www.google.com')
  })

  it('returns nulls for a direct visit with no query params or referrer', () => {
    const storage = createMemoryStorage()
    const source = captureTrafficSource('', '', storage)
    expect(source).toEqual({ utm_source: null, ref: null })
  })

  it('reuses the stored source on subsequent calls instead of re-parsing', () => {
    const storage = createMemoryStorage()
    captureTrafficSource('?utm_source=newsletter', '', storage)
    const second = captureTrafficSource('?utm_source=something-else', '', storage)
    expect(second.utm_source).toBe('newsletter')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run tests/utm.test.ts
```

Expected: FAIL — `web/app/utils/utm.ts` does not exist.

- [ ] **Step 3: Create `web/app/utils/utm.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npx vitest run tests/utm.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/utils/utm.ts web/tests/utm.test.ts
git commit -m "feat: add traffic-source (utm_source/ref) capture utility"
```

---

### Task 9: Checkout page (flaky payment) + checkout_start tracking

**Files:**
- Create: `web/app/pages/checkout.vue`

**Interfaces:**
- Consumes: `useCart()` (Task 3), `trackEvent` (Task 2), `simulatePayment` (Task 7). `Sentry.captureException` is called here but the SDK is not installed until Task 12 — that is fine, `@sentry/vue` is already a `web/package.json` dependency since Task 1, so the import resolves; it will simply be a no-op capture until Task 12 initializes Sentry.

- [ ] **Step 1: Create `web/app/pages/checkout.vue`**

```vue
<template>
  <section>
    <h1>Livraison & Paiement</h1>
    <form @submit.prevent="pay">
      <label>
        Adresse de livraison
        <input v-model="address" type="text" required data-testid="address-input" />
      </label>
      <p v-if="paymentError" class="error">{{ paymentError }}</p>
      <button type="submit" :disabled="isPaying" data-testid="pay-button">
        {{ isPaying ? 'Paiement en cours…' : 'Payer' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import * as Sentry from '@sentry/vue'

const cart = useCart()
const { trackEvent } = useAnalytics()
const router = useRouter()

// Never sent to GlitchTip or Umami — kept purely client-side (RGPD: no PII in telemetry).
const address = ref('')
const paymentError = ref('')
const isPaying = ref(false)

onMounted(() => {
  trackEvent('checkout_start', { items: cart.count.value, value: cart.total.value })
})

async function pay() {
  isPaying.value = true
  paymentError.value = ''
  const result = simulatePayment()
  if (!result.success && result.error) {
    Sentry.captureException(result.error)
    paymentError.value = 'Le paiement a échoué. Merci de réessayer.'
    isPaying.value = false
    return
  }
  await router.push('/checkout/success')
}
</script>
```

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/pages/checkout.vue
git commit -m "feat: add checkout page with flaky payment and checkout_start tracking"
```

---

### Task 10: Checkout success page + checkout_success tracking

**Files:**
- Create: `web/app/pages/checkout/success.vue`

**Interfaces:**
- Consumes: `useCart()` (Task 3), `trackEvent` (Task 2), `captureTrafficSource` (Task 8).

- [ ] **Step 1: Create `web/app/pages/checkout/success.vue`**

```vue
<template>
  <section>
    <h1 data-testid="order-confirmation">Merci pour votre commande !</h1>
    <p>Votre paiement de {{ orderTotal.toFixed(2) }} € a été confirmé.</p>
    <NuxtLink to="/products">Continuer mes achats</NuxtLink>
  </section>
</template>

<script setup lang="ts">
const cart = useCart()
const { trackEvent } = useAnalytics()

// Captured before onMounted's cart.clear() runs.
const orderTotal = cart.total.value
const orderItems = cart.count.value

onMounted(() => {
  const source = captureTrafficSource(window.location.search, document.referrer)
  trackEvent('checkout_success', {
    value: orderTotal,
    items: orderItems,
    utm_source: source.utm_source,
    ref: source.ref
  })
  cart.clear()
})
</script>
```

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/pages/checkout/success.vue
git commit -m "feat: add checkout success page with checkout_success tracking and cart clear"
```

---

### Task 11: Nuxt app Dockerfile

**Files:**
- Create: `web/Dockerfile`

- [ ] **Step 1: Create `web/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Build the image and verify it serves the app standalone**

```bash
cd web && docker build -t eshop-monitor-web:test .
docker run -d --rm --name eshop-web-test -p 3100:3000 eshop-monitor-web:test
sleep 2
curl -sf http://localhost:3100/ | grep -q "Eco-Hardware" && echo "OK"
docker stop eshop-web-test
```

Expected: prints `OK`, container stops cleanly.

- [ ] **Step 3: Commit**

```bash
git add web/Dockerfile
git commit -m "build: add multi-stage Dockerfile for the Nuxt app"
```

---

### Task 12: Root compose.yml — Traefik + web service

**Files:**
- Create: `compose.yml`
- Create: `.env.example`

**Interfaces:**
- Produces: the `proxy` Docker network every later compose task (13, 14) attaches its user-facing service to, and the `.env.example` file later tasks append variables to.

- [ ] **Step 1: Create `.env.example`**

```dotenv
# --- Nuxt app runtime config (fill in AFTER first boot — see README "Bootstrap") ---
NUXT_PUBLIC_GLITCHTIP_DSN=
NUXT_PUBLIC_UMAMI_HOST=http://umami.localhost
NUXT_PUBLIC_UMAMI_WEBSITE_ID=
```

- [ ] **Step 2: Create `compose.yml` with Traefik and the web service**

```yaml
services:
  traefik:
    image: traefik:v3.3
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [proxy]
    restart: unless-stopped

  web:
    build: ./web
    environment:
      NUXT_PUBLIC_GLITCHTIP_DSN: ${NUXT_PUBLIC_GLITCHTIP_DSN}
      NUXT_PUBLIC_UMAMI_HOST: ${NUXT_PUBLIC_UMAMI_HOST}
      NUXT_PUBLIC_UMAMI_WEBSITE_ID: ${NUXT_PUBLIC_UMAMI_WEBSITE_ID}
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.web.rule=Host(`shop.localhost`)
      - traefik.http.routers.web.entrypoints=web
      - traefik.http.services.web.loadbalancer.server.port=3000
    depends_on: [traefik]
    restart: unless-stopped

networks:
  proxy:
```

- [ ] **Step 3: Boot and verify**

```bash
cp .env.example .env
docker compose up -d --build
sleep 3
curl -sf -H "Host: shop.localhost" http://localhost/ | grep -q "Eco-Hardware" && echo "OK"
docker compose down
```

Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add compose.yml .env.example
git commit -m "build: add Traefik + web service to compose.yml"
```

---

### Task 13: compose.yml — GlitchTip stack

**Files:**
- Modify: `compose.yml`
- Modify: `.env.example`

**Interfaces:**
- Produces: the `glitchtip` service reachable at `http://glitchtip.localhost`, backing Postgres on the private `glitchtip-internal` network with a named volume, satisfying Sujet.md §3's "1 PostgreSQL + 1 Redis + 1 GlitchTip" requirement.

- [ ] **Step 1: Append GlitchTip variables to `.env.example`**

```dotenv

# --- GlitchTip ---
GLITCHTIP_POSTGRES_PASSWORD=change_me_glitchtip_pg
GLITCHTIP_SECRET_KEY=change_me_run_openssl_rand_hex_32
```

- [ ] **Step 2: Add the GlitchTip services to `compose.yml`**

Insert before the `networks:` block at the end of the file:

```yaml
  glitchtip-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: glitchtip
      POSTGRES_USER: glitchtip
      POSTGRES_PASSWORD: ${GLITCHTIP_POSTGRES_PASSWORD}
    volumes:
      - glitchtip-pg-data:/var/lib/postgresql/data
    networks: [glitchtip-internal]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U glitchtip -d glitchtip"]
      interval: 5s
      timeout: 5s
      retries: 5

  glitchtip-redis:
    image: redis:7-alpine
    networks: [glitchtip-internal]
    restart: unless-stopped

  glitchtip:
    image: glitchtip/glitchtip:6
    depends_on:
      glitchtip-postgres:
        condition: service_healthy
      glitchtip-redis:
        condition: service_started
    environment:
      DATABASE_URL: postgres://glitchtip:${GLITCHTIP_POSTGRES_PASSWORD}@glitchtip-postgres:5432/glitchtip
      VALKEY_URL: redis://glitchtip-redis:6379
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
      EMAIL_URL: consolemail://
      GLITCHTIP_DOMAIN: http://glitchtip.localhost
      DEFAULT_FROM_EMAIL: noreply@eshop-monitor.local
      SERVER_ROLE: all_in_one
    volumes:
      - glitchtip-uploads:/code/uploads
    networks: [proxy, glitchtip-internal]
    labels:
      - traefik.enable=true
      - traefik.http.routers.glitchtip.rule=Host(`glitchtip.localhost`)
      - traefik.http.routers.glitchtip.entrypoints=web
      - traefik.http.services.glitchtip.loadbalancer.server.port=8000
    restart: unless-stopped
```

And update the `volumes:`/`networks:` top-level blocks (create `volumes:` if it doesn't exist yet):

```yaml
volumes:
  glitchtip-pg-data:
  glitchtip-uploads:

networks:
  proxy:
  glitchtip-internal:
```

- [ ] **Step 3: Boot and verify**

```bash
cp .env.example .env   # only if .env doesn't already exist; otherwise merge the new vars in manually
docker compose up -d --build
sleep 15
curl -sf -H "Host: glitchtip.localhost" http://localhost/ -o /dev/null -w "%{http_code}\n"
docker volume ls | grep glitchtip
docker compose down
```

Expected: HTTP status `200` (or `302` to the login/setup page), and both `..._glitchtip-pg-data` and `..._glitchtip-uploads` volumes listed.

- [ ] **Step 4: Commit**

```bash
git add compose.yml .env.example
git commit -m "build: add GlitchTip stack (postgres + redis + glitchtip) to compose.yml"
```

---

### Task 14: compose.yml — Umami stack

**Files:**
- Modify: `compose.yml`
- Modify: `.env.example`

**Interfaces:**
- Produces: the `umami` service reachable at `http://umami.localhost`, backing Postgres on the private `analytics-internal` network with a named volume, satisfying Sujet.md §3's "1 PostgreSQL + 1 Umami" requirement.

- [ ] **Step 1: Append Umami variables to `.env.example`**

```dotenv

# --- Umami ---
UMAMI_POSTGRES_PASSWORD=change_me_umami_pg
UMAMI_APP_SECRET=change_me_run_openssl_rand_hex_32
```

- [ ] **Step 2: Add the Umami services to `compose.yml`**

Insert alongside the GlitchTip services, before the `volumes:`/`networks:` blocks:

```yaml
  umami-postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: ${UMAMI_POSTGRES_PASSWORD}
    volumes:
      - umami-pg-data:/var/lib/postgresql/data
    networks: [analytics-internal]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U umami -d umami"]
      interval: 5s
      timeout: 5s
      retries: 5

  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    depends_on:
      umami-postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://umami:${UMAMI_POSTGRES_PASSWORD}@umami-postgres:5432/umami
      APP_SECRET: ${UMAMI_APP_SECRET}
    networks: [proxy, analytics-internal]
    labels:
      - traefik.enable=true
      - traefik.http.routers.umami.rule=Host(`umami.localhost`)
      - traefik.http.routers.umami.entrypoints=web
      - traefik.http.services.umami.loadbalancer.server.port=3000
    restart: unless-stopped
```

Update the top-level `volumes:`/`networks:` blocks:

```yaml
volumes:
  glitchtip-pg-data:
  glitchtip-uploads:
  umami-pg-data:

networks:
  proxy:
  glitchtip-internal:
  analytics-internal:
```

- [ ] **Step 3: Boot and verify all three routed services at once**

```bash
docker compose up -d --build
sleep 15
curl -sf -H "Host: shop.localhost" http://localhost/ -o /dev/null -w "web: %{http_code}\n"
curl -sf -H "Host: glitchtip.localhost" http://localhost/ -o /dev/null -w "glitchtip: %{http_code}\n"
curl -sf -H "Host: umami.localhost" http://localhost/ -o /dev/null -w "umami: %{http_code}\n"
docker volume ls | grep umami
```

Expected: all three print a `2xx`/`3xx` status; `..._umami-pg-data` volume listed. Leave the stack running for Task 15+.

- [ ] **Step 4: Commit**

```bash
git add compose.yml .env.example
git commit -m "build: add Umami stack (postgres + umami) to compose.yml"
```

---

### Task 15: GlitchTip SDK integration + PII scrubbing

**Files:**
- Create: `web/app/plugins/sentry.client.ts`

**Interfaces:**
- Consumes: `config.public.glitchtipDsn` (Task 1's `nuxt.config.ts` runtime config).
- Produces: global `Sentry.captureException` availability for Task 9's `pay()` handler, automatic unhandled-exception capture for the whole app, and browser performance tracing (pageload/navigation spans) covering the `/checkout` route.

- [ ] **Step 1: Create `web/app/plugins/sentry.client.ts`**

```ts
import * as Sentry from '@sentry/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  if (!config.public.glitchtipDsn) return

  Sentry.init({
    app: nuxtApp.vueApp,
    dsn: config.public.glitchtipDsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0, // demo project: capture every transaction. Lower this in production.
    autoSessionTracking: false, // GlitchTip does not support sessions
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }
      return event
    }
  })
})
```

Because this plugin is skipped entirely when `glitchtipDsn` is empty, `npm run build`/local `npm run dev` keep working before Task 17's bootstrap step provides a real DSN.

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/plugins/sentry.client.ts
git commit -m "feat: initialize GlitchTip/Sentry SDK with PII scrubbing and browser tracing"
```

---

### Task 16: Umami tracker script injection

**Files:**
- Create: `web/app/plugins/umami.client.ts`

**Interfaces:**
- Consumes: `config.public.umamiHost`, `config.public.umamiWebsiteId` (Task 1's `nuxt.config.ts` runtime config).
- Produces: the `window.umami` global that `trackEvent` (Task 2) checks for, loaded site-wide so standard metrics (sessions, page views, bounce rate, session duration) are collected automatically on every page including the home page.

- [ ] **Step 1: Create `web/app/plugins/umami.client.ts`**

```ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.public.umamiHost || !config.public.umamiWebsiteId) return

  useHead({
    script: [
      {
        src: `${config.public.umamiHost}/script.js`,
        defer: true,
        'data-website-id': config.public.umamiWebsiteId
      }
    ]
  })
})
```

- [ ] **Step 2: Verify the app builds**

```bash
cd web && npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add web/app/plugins/umami.client.ts
git commit -m "feat: inject Umami tracker script site-wide via runtime config"
```

---

### Task 17: Bootstrap runtime configuration (manual, one-time)

This task cannot be automated: GlitchTip only issues a DSN after a project is created through its web UI, and Umami only issues a website ID after a website is registered through its web UI. Both require a human (or the demo-traffic script from Task 18, for repeatable dry-runs) to click through the onboarding flow once per environment.

**Files:**
- Modify: `.env` (not `.env.example` — this file is gitignored and holds real secrets/DSNs)

- [ ] **Step 1: Start the full stack**

```bash
docker compose up -d --build
```

- [ ] **Step 2: Create the GlitchTip organization, project, and DSN**

1. Open `http://glitchtip.localhost` in a browser.
2. Sign up for the first account (this becomes the organization owner).
3. Create an organization, e.g. "Eco-Hardware".
4. Create a project, e.g. "eshop-monitor-web", platform "Vue" / "JavaScript".
5. GlitchTip displays the project's DSN (format `http://<public_key>@glitchtip.localhost/<project_id>`) on the project setup screen, and again under Project Settings → Client Keys (DSN).
6. Copy that DSN into `.env`:

```dotenv
NUXT_PUBLIC_GLITCHTIP_DSN=http://<public_key>@glitchtip.localhost/<project_id>
```

- [ ] **Step 3: Create the Umami website and copy its website ID**

1. Open `http://umami.localhost` in a browser.
2. Log in with the default credentials `admin` / `umami`.
3. Change the admin password immediately when prompted (or via Settings → Profile).
4. Go to Websites → Add website, name it "Eco-Hardware Shop", domain `shop.localhost`, save.
5. Open the website's Settings page — it displays a "Website ID" (a UUID).
6. Copy it into `.env`:

```dotenv
NUXT_PUBLIC_UMAMI_WEBSITE_ID=<the-uuid-shown-in-umami>
```

`NUXT_PUBLIC_UMAMI_HOST` is already set to `http://umami.localhost` in `.env.example`; leave it as-is.

- [ ] **Step 4: Restart the web service to pick up the new runtime config**

```bash
docker compose up -d --build web
```

- [ ] **Step 5: Verify both integrations are live**

```bash
curl -s -H "Host: shop.localhost" http://localhost/ | grep -q "umami.localhost/script.js" && echo "umami script present"
```

Then in a browser: visit `http://shop.localhost`, browse a product, add it to cart, and check that a `view_product` / `add_to_cart` event shows up under the Umami website's Realtime tab within a few seconds. Separately, visit `/checkout` and keep clicking "Payer" until it fails (≈1 in 3 tries) — confirm the error appears under the GlitchTip project's Issues tab with a stack trace, browser, and OS.

- [ ] **Step 6: Commit**

`.env` itself must stay gitignored (it now holds a live DSN and passwords). Nothing to commit from this task — it is a runtime/local configuration step, not a code change. Skip the commit.

---

### Task 18: Demo traffic generator (Playwright)

**Files:**
- Create: `scripts/demo-traffic/package.json`
- Create: `scripts/demo-traffic/generate-demo-traffic.mjs`

**Interfaces:**
- Consumes: the four `data-testid` attributes wired into pages in Tasks 4, 5, 6, 9 (`cta-view-products`, `product-link`, `add-to-cart`, `go-to-checkout`, `address-input`, `pay-button`), and the running stack from Task 17.
- Produces: repeatable, realistic funnel traffic (with drop-off at every stage and varied `utm_source` values) for the screenshots required in Task 20's report.

- [ ] **Step 1: Create `scripts/demo-traffic/package.json`**

```json
{
  "name": "eshop-monitor-demo-traffic",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node generate-demo-traffic.mjs"
  },
  "dependencies": {
    "playwright": "^1.61.1"
  }
}
```

- [ ] **Step 2: Create `scripts/demo-traffic/generate-demo-traffic.mjs`**

```js
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://shop.localhost'
const JOURNEY_COUNT = Number(process.argv[2] ?? 30)
const UTM_SOURCES = ['newsletter', 'google-ads', 'facebook', null, null]

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function proceeds(probability) {
  return Math.random() < probability
}

async function runJourney(browser, index) {
  const context = await browser.newContext()
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

  await page.goto(`${BASE_URL}/cart`)
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
```

- [ ] **Step 3: Install and run against the live stack from Task 17**

```bash
cd scripts/demo-traffic
npm install
npx playwright install --with-deps chromium
npm start 30
```

Expected: 30 lines of per-journey logs plus a final `Done: 30 simulated journeys...` line, no uncaught exceptions from the script itself (the app's own payment failures are expected and logged as retries).

- [ ] **Step 4: Commit**

```bash
git add scripts/demo-traffic
git commit -m "feat: add Playwright demo-traffic generator simulating the purchase funnel"
```

---

### Task 19: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# E-Shop Monitor — Eco-Hardware

Démo e-commerce auto-hébergée instrumentée avec GlitchTip (erreurs + performance) et Umami (analytique produit + tunnel de conversion), orchestrée entièrement via Docker Compose.

## Démarrage rapide

Prérequis : Docker + Docker Compose v2, un port 80 libre en local.

```bash
cp .env.example .env
# éditer .env : définir des mots de passe/secrets pour GLITCHTIP_POSTGRES_PASSWORD,
# GLITCHTIP_SECRET_KEY, UMAMI_POSTGRES_PASSWORD, UMAMI_APP_SECRET
docker compose up -d --build
```

Trois domaines locaux (résolus automatiquement, aucune modification de `/etc/hosts` requise) :

| Service | URL |
| --- | --- |
| Boutique | http://shop.localhost |
| GlitchTip | http://glitchtip.localhost |
| Umami | http://umami.localhost |

## Configuration post-démarrage (obligatoire)

`NUXT_PUBLIC_GLITCHTIP_DSN` et `NUXT_PUBLIC_UMAMI_WEBSITE_ID` ne peuvent être connus qu'après la création d'un projet GlitchTip et d'un site Umami via leurs interfaces web respectives. Suivre la procédure détaillée dans `docs/superpowers/plans/2026-07-20-e-shop-monitor.md` (Tâche 17), en résumé :

1. Créer un compte + une organisation + un projet sur GlitchTip → copier le DSN affiché dans `.env` (`NUXT_PUBLIC_GLITCHTIP_DSN`).
2. Se connecter à Umami (`admin` / `umami`, à changer immédiatement) → ajouter un site `shop.localhost` → copier son Website ID dans `.env` (`NUXT_PUBLIC_UMAMI_WEBSITE_ID`).
3. Relancer le service web : `docker compose up -d --build web`.

## Générer du trafic de démonstration

```bash
cd scripts/demo-traffic
npm install
npx playwright install --with-deps chromium
npm start 30   # simule 30 parcours utilisateurs avec abandons réalistes à chaque étape
```

## Architecture

```
Traefik (:80, routage par Host header *.localhost)
 ├─ shop.localhost      → web (Nuxt 4, réseau "proxy")
 ├─ glitchtip.localhost → glitchtip (réseau "proxy" + "glitchtip-internal")
 │                          ├─ glitchtip-postgres (réseau "glitchtip-internal" uniquement)
 │                          └─ glitchtip-redis    (réseau "glitchtip-internal" uniquement)
 └─ umami.localhost     → umami (réseau "proxy" + "analytics-internal")
                             └─ umami-postgres    (réseau "analytics-internal" uniquement)
```

Les bases de données ne sont jamais exposées sur le réseau `proxy` ni sur l'hôte : elles ne sont joignables que par le service applicatif auquel elles appartiennent.

## Plan de marquage (Umami)

| Événement | Déclencheur | Propriétés |
| --- | --- | --- |
| `view_product` | Affichage d'une fiche produit | `product_id`, `name`, `price` |
| `add_to_cart` | Clic sur "Ajouter au panier" | `product_id`, `name`, `price` |
| `checkout_start` | Arrivée sur `/checkout` | `items`, `value` |
| `checkout_success` | Arrivée sur `/checkout/success` | `value`, `items`, `utm_source`, `ref` |

## RGPD

- Umami ne dépose aucun cookie et n'enregistre aucune donnée personnelle par conception.
- Le SDK GlitchTip est initialisé avec `sendDefaultPii: false` et un hook `beforeSend` qui supprime `event.user`, les cookies et les en-têtes de requête avant envoi.
- Le formulaire de livraison (adresse) reste strictement local au navigateur : il n'est jamais transmis à GlitchTip ni à Umami.

## Tests

```bash
cd web
npm install
npm run test    # Vitest — composables cart/analytics, utilitaires payment/utm, catalogue produits
npm run build   # build de production Nuxt
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, architecture, and tracking plan"
```

---

### Task 20: Rapport d'observabilité (template)

The report's body (screenshots, measured bounce/conversion rates, the incident write-up) can only be produced after Task 17's live stack has real traffic (from Task 18's script or manual clicking) and real GlitchTip/Umami dashboards to screenshot from. This task delivers the exact structure and instructions Sujet.md §5.3 requires; filling in the screenshots and numbers is a manual step performed once the stack is running.

**Files:**
- Create: `docs/rapport-observabilite.md`

- [ ] **Step 1: Create `docs/rapport-observabilite.md`**

```markdown
# Rapport d'observabilité — E-Shop Monitor

> Compléter ce rapport après avoir exécuté `scripts/demo-traffic` (ou navigué manuellement) contre la stack lancée via `docker compose up`.

## 1. Tunnel d'achat (Umami)

**Capture d'écran :** dashboard Umami → onglet du site "Eco-Hardware Shop" → section Rapports → Funnel (ou, à défaut sur les versions sans ce rapport, l'onglet Événements), montrant les quatre étapes `view_product`, `add_to_cart`, `checkout_start`, `checkout_success` avec leurs volumes respectifs.

`[Insérer capture d'écran ici]`

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

## 2. Métriques standards (Umami)

**Capture d'écran :** dashboard Umami → vue d'ensemble du site, montrant sessions uniques, pages vues, durée moyenne de session, et taux de rebond de la page d'accueil.

`[Insérer capture d'écran ici]`

- Sessions uniques : `___`
- Pages vues : `___`
- Durée moyenne de session : `___`
- Taux de rebond (page d'accueil) : `___ %` — commenter si ce taux est cohérent avec le scénario de démonstration simulé.

## 3. Panier moyen et origine du trafic

- Montant moyen des `checkout_success` (propriété `value`) : `___ €`
- Répartition des `checkout_success` par `utm_source` : `___`

## 4. Erreur de paiement simulée (GlitchTip)

**Capture d'écran :** GlitchTip → Issues → l'erreur du bouton de paiement défaillant, montrant la stack trace complète, le navigateur et l'OS du client.

`[Insérer capture d'écran ici]`

**Explication technique :** décrire, à partir de la stack trace visible dans GlitchTip (fichier, ligne, message d'erreur `TypeError` ou rejet de promesse), comment un développeur identifierait la cause racine et la corrigerait — par exemple : le message et la ligne pointent vers `simulatePayment()` dans `web/app/utils/payment.ts`, ce qui indique une réponse du gateway de paiement non gérée ; un correctif réaliste consisterait à ajouter une validation de la réponse avant d'en lire les propriétés, ou une politique de nouvelle tentative (retry) côté client.

## 5. Suivi de performance (GlitchTip)

**Capture d'écran :** GlitchTip → Performance → transactions des pages `/checkout` et `/checkout/success`, montrant le temps de chargement mesuré.

`[Insérer capture d'écran ici]`

- Temps de chargement médian observé pour `/checkout` : `___ ms`
- Temps de chargement médian observé pour `/checkout/success` (page de validation de commande) : `___ ms`
```

- [ ] **Step 2: Commit**

```bash
git add docs/rapport-observabilite.md
git commit -m "docs: add observability report template"
```
