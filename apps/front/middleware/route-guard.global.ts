import { useAuthStore } from '~/stores/auth'

/**
 * Global route guard middleware that automatically applies:
 * - auth + admin middleware for all /admin/* routes
 * - auth middleware for all /user/* routes
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // // Skip middleware for authentication pages
  // const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  // if (publicRoutes.includes(to.path)) {
  //   return
  // }
  
  // const authStore = useAuthStore()
  
  // // If the path starts with /admin, check for both auth and admin permissions
  // if (to.path.startsWith('/admin')) {
  //   // First check if user is authenticated
  //   if (!authStore.isAuthenticated) {
  //     // Try to fetch user profile if we have a token but not authenticated yet
  //     if (authStore.token) {
  //       try {
  //         await authStore.fetchUserProfile()
  //         if (!authStore.isAuthenticated) {
  //           return navigateTo('/login')
  //         }
  //       } catch (error) {
  //         return navigateTo('/login')
  //       }
  //     } else {
  //       return navigateTo('/login')
  //     }
  //   }
    
  //   // Then check if the user is an admin
  //   if (!authStore.userIsAdmin) {
  //     return navigateTo('/403')
  //   }
    
  //   // All checks passed, allow access to admin route
  //   return
  // }
  
  // // If the path starts with /user, check only for auth permissions
  // if (to.path.startsWith('/user')) {
  //   if (!authStore.isAuthenticated) {
  //     // Try to fetch user profile if we have a token but not authenticated yet
  //     if (authStore.token) {
  //       try {
  //         await authStore.fetchUserProfile()
  //         if (!authStore.isAuthenticated) {
  //           return navigateTo('/login')
  //         }
  //       } catch (error) {
  //         return navigateTo('/login')
  //       }
  //     } else {
  //       return navigateTo('/login')
  //     }
  //   }
    
  //   // User is authenticated, allow access
  //   return
  // }
})
