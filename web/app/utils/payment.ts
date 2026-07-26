export interface PaymentResult {
  success: boolean
  error?: Error
}

export function simulatePayment(random: () => number = Math.random): PaymentResult {
  if (random() < 1 / 3) {
    if (random() < 0.5) {
      return {
        success: false,
        error: new TypeError("Impossible de lire la propriété 'status' de la réponse du gateway de paiement (undefined).")
      }
    }
    return {
      success: false,
      error: new Error('Le gateway de paiement a rejeté la transaction (timeout).')
    }
  }
  return { success: true }
}
