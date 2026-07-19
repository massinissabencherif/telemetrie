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
