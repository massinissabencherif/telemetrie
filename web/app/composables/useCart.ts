import { ref, computed } from 'vue'

const items = ref<{ productId: string; name: string; price: number; quantity: number }[]>([])
const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

export function useCart() {
  return { items, count }
}
