export default defineNuxtPlugin((nuxtApp) => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Set up a global state for the dev toggle
  const showKeys = useState('i18n-show-keys', () => false);

  // Hook into the Vue app to override $t
  nuxtApp.hook('app:created', (vueApp) => {
    // Save the original translation function provided by vue-i18n
    const originalT = vueApp.config.globalProperties.$t as
      | ((key: string, ...args: unknown[]) => string)
      | undefined;
    if (!originalT) return;

    // Replace it globally
    vueApp.config.globalProperties.$t = function (
      key: string,
      ...args: unknown[]
    ) {
      if (showKeys.value) {
        // Return a special marker string to make it easier to find if necessary, or just the key.
        // Let's just return the key for now. Later we can intercept clicks on elements that contain this key.
        return key;
      }
      return originalT.call(this, key, ...args);
    };
  });
});
