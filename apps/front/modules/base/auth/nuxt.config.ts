export default defineNuxtConfig({
  components: [
    {
      path: "./components/auth",
      pathPrefix: false,
    },
  ],
  imports: {
    dirs: ["./stores", "./composables"],
  },
});
