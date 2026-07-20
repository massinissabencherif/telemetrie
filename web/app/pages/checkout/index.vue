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
