export default defineNuxtPlugin(async () => {
  const store = useOrderingStore()
  if (!store.hydrated) {
    await store.init()
  } else {
    // Background revalidate — no await
    store.init()
  }
})