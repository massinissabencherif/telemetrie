export default defineNuxtPlugin(() => {
  captureTrafficSource(window.location.search, document.referrer)
})
