export default defineNuxtConfig({
  components: [
    { path: "./components", pathPrefix: false },
    { path: "./components/data-table", pathPrefix: true },
    { path: "./components/form", pathPrefix: false }, // FormInput.vue is already prefixed
    { path: "./components/rich-editor", pathPrefix: false }, // RichEditor.vue is already prefixed
    { path: "./components/scheduling", pathPrefix: true },
    { path: "./components/dashboard", pathPrefix: true },
    { path: "./components/automation", pathPrefix: true },
  ],
  imports: {
    dirs: ["./stores", "./lib"],
  },
});
