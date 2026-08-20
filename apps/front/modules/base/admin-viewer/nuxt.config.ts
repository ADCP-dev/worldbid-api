export default defineNuxtConfig({
  components: [
    {
      path: './components',
      prefix: 'AdminViewer',
    },
  ],
  imports: {
    dirs: ['./composables', './utils'],
  },
});