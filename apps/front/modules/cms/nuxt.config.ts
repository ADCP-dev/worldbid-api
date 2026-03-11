export default defineNuxtConfig({
  components: [{ path: "./components", pathPrefix: false }],
  imports: { dirs: ["./stores", "./composables"] },
  future: {
    compatibilityVersion: 4,
  },
});
