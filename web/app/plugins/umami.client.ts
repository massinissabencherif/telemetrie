export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.public.umamiHost || !config.public.umamiWebsiteId) return

  useHead({
    script: [
      {
        src: `${config.public.umamiHost}/script.js`,
        defer: true,
        'data-website-id': config.public.umamiWebsiteId
      }
    ]
  })
})
