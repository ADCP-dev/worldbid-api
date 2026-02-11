import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware if the user is on a public route
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  if (publicRoutes.includes(to.path)) {
    return
  }

  const authStore = useAuthStore()

  // If the store has been initialized and user is authenticated, allow access
  if (authStore.isAuthenticated) {
    return
  }

  // If we have a token but not authenticated yet, try to fetch user profile
  if (authStore.token && !authStore.isAuthenticated) {
    try {
      await authStore.fetchUserProfile()
      
      // If authentication succeeded, allow access
      if (authStore.isAuthenticated) {
        return
      }
    } catch (error) {
      // If fetching profile fails, redirect to login
      return navigateTo('/login')
    }
  }

  // If no token or failed to authenticate, redirect to login
  return navigateTo('/login')
})
