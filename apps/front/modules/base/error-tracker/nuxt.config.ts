export default defineNuxtConfig({
  components: [
    {
      path: "./components",
      prefix: "ErrorTracker",
    },
  ],
  imports: {
    dirs: ["./composables"],
  },
});
