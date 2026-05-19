export default defineNuxtConfig({
  components: [{ path: "./components", pathPrefix: false }],
  imports: { dirs: ["./composables"] },
  future: {
    compatibilityVersion: 4,
  },
});
