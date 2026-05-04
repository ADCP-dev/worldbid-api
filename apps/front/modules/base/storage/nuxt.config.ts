export default defineNuxtConfig({
  components: [
    {
      path: './components',
      prefix: 'Storage',
    },
  ],
  imports: {
    dirs: ['./composables'],
  },
});
