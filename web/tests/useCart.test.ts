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
