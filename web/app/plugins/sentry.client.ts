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
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }
      return event
    }
  })
})
