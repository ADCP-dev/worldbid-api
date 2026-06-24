// extensions/stripe/nuxt.config.ts
// Stripe extension layer. Auto-discovers composables in ./composables
// and components in ./components (no prefix).
export default defineNuxtConfig({
  components: [{ path: './components', pathPrefix: false }],
  imports: { dirs: ['./composables'] },
  future: {
    compatibilityVersion: 4,
  },
})
