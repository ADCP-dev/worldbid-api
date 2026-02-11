import { useAuthStore } from '~/stores/auth'

/**
 * Admin middleware - allows access only to authenticated users with admin role
 * This middleware should be used in addition to auth middleware
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  
  // First ensure the user is authenticated - this might be redundant
  // if you're already using the auth middleware, but it's a safety check
  if (!authStore.isAuthenticated) {
    return navigateTo('/login')
  }
  
  // Check if the user has admin role
  if (!authStore.userIsAdmin) {
    // You could redirect to a 403 forbidden page
    return navigateTo('/403')
    
    // Or simply redirect to the user's homepage
    // return navigateTo('/')
  }
})
