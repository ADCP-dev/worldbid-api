export default defineNuxtConfig({
  components: [
    { path: "./components", pathPrefix: false, extensions: [".vue"] },
    { path: "./components/data-table", pathPrefix: true, extensions: [".vue"] },
    { path: "./components/form", pathPrefix: false, extensions: [".vue"] },
    { path: "./components/rich-editor", pathPrefix: false, extensions: [".vue"] },
    { path: "./components/scheduling", pathPrefix: true, extensions: [".vue"] },
    { path: "./components/dashboard", pathPrefix: true, extensions: [".vue"] },
    { path: "./components/automation", pathPrefix: true, extensions: [".vue"] },
  ],
  imports: {
    dirs: ["./stores", "./lib"],
  },
});
