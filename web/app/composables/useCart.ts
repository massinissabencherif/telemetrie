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
