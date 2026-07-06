// extensions/tokens/nuxt.config.ts
// Token-usage extension layer. Auto-discovers composables and components.
export default defineNuxtConfig({
  components: [{ path: './components', pathPrefix: false }],
  imports: { dirs: ['./composables'] },
  future: {
    compatibilityVersion: 4,
  },
})
