export default defineNuxtConfig({
  components: [
    { path: "./components/data-table", pathPrefix: true },
    { path: "./components/form", pathPrefix: false }, // FormInput.vue is already prefixed
    { path: "./components/rich-editor", pathPrefix: false }, // RichEditor.vue is already prefixed
  ],
  imports: {
    dirs: ["./stores", "./lib"],
  },
});
