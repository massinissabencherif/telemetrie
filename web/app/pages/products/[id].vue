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
