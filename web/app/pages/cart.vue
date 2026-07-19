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
