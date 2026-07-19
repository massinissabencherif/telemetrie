export interface Product {
  id: string
  name: string
  price: number
  description: string
  emoji: string
}

export const products: Product[] = [
  { id: 'p1', name: 'Perceuse visseuse 18V', price: 89.9, description: 'Perceuse sans fil avec deux batteries et coffret de rangement.', emoji: '🔧' },
  { id: 'p2', name: 'Scie sauteuse 650W', price: 64.5, description: 'Scie sauteuse filaire, lame réglable, idéale pour le bois et le métal.', emoji: '🪚' },
  { id: 'p3', name: 'Établi pliable 150kg', price: 129.0, description: 'Établi robuste pliable, charge max 150kg, mors ajustables.', emoji: '🛠️' },
  { id: 'p4', name: 'Casque de protection auditive', price: 24.9, description: 'Casque anti-bruit SNR 27dB pour travaux bruyants.', emoji: '🎧' },
  { id: 'p5', name: 'Niveau à bulle 60cm', price: 18.3, description: 'Niveau aluminium 3 bulles, précision professionnelle.', emoji: '📏' },
  { id: 'p6', name: 'Kit tournevis de précision (32 pièces)', price: 15.9, description: 'Set complet pour électronique et petite maintenance.', emoji: '🪛' }
]

export function getProducts(): Product[] {
  return products
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}
