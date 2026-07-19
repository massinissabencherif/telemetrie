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
