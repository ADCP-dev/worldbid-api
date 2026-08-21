export default defineNuxtConfig({
  components: [{ path: './components', pathPrefix: false, global: true }],
  imports: { dirs: ['./composables', './stores'] },
  future: {
    compatibilityVersion: 4,
  },
});