import * as Sentry from '@sentry/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  if (!config.public.glitchtipDsn) return

  Sentry.init({
    app: nuxtApp.vueApp,
    dsn: config.public.glitchtipDsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0, // demo project: capture every transaction. Lower this in production.
    autoSessionTracking: false, // GlitchTip does not support sessions
    // true so the SDK attaches browser/OS context (coarse-grained, not PII on
    // its own) — beforeSend below still strips anything actually identifying
    // (user, cookies, IP-bearing headers) that this would otherwise include.
    sendDefaultPii: true,
    beforeSend(event) {
      delete event.user
      if (event.request) {
        delete event.request.cookies
        // Keep User-Agent: it's how GlitchTip derives the Browser/OS shown on
        // an issue (required by the assignment), and it isn't PII on its own.
        // Strip anything else that could carry auth/session/identity data.
        const userAgent = event.request.headers?.['User-Agent']
        event.request.headers = userAgent ? { 'User-Agent': userAgent } : undefined
      }
      return event
    }
  })
})
