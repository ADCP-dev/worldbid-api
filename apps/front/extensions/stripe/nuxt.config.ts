<<<<<<< HEAD
// extensions/stripe/nuxt.config.ts
// Stripe extension layer. Auto-discovers composables in ./composables
// and components in ./components (no prefix).
=======
>>>>>>> 3aded1db4c5a7ba899a388bdcca402c0f4116137
export default defineNuxtConfig({
  components: [{ path: './components', pathPrefix: false }],
  imports: { dirs: ['./composables'] },
  future: {
    compatibilityVersion: 4,
  },
<<<<<<< HEAD
})
=======
});
>>>>>>> 3aded1db4c5a7ba899a388bdcca402c0f4116137
