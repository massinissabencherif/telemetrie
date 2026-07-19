declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void
    }
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.umami) return
  window.umami.track(name, props)
}

export function useAnalytics() {
  return { trackEvent }
}
