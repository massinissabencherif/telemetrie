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
