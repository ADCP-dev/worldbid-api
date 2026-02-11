import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin(async () => {
  // Initialize the auth store at app startup
  const authStore = useAuthStore()
  
  // This will attempt to restore the session from localStorage
  // and fetch the user profile if a token exists
  await authStore.init()
  
  return {
    provide: {
      auth: authStore
    }
  }
})
