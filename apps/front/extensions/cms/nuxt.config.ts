export default defineNuxtConfig({
  components: [{ path: "./components", pathPrefix: false, global: true }],
  imports: { dirs: ["./composables"] },
  future: {
    compatibilityVersion: 4,
  },
});
