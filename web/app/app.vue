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
