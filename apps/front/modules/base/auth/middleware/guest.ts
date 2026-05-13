import { sanitizeRedirect } from '@base/auth/utils/redirect'

export default defineNuxtRouteMiddleware((to) => {
  const { route: homeRoute } = useHomeRoute();

  // If user is authenticated, redirect away from login pages
  const authStore = useAuthStore();
  if (authStore.isAuthenticated) {
    const redirect = sanitizeRedirect(to.query.redirect);
    if (redirect) {
      return navigateTo(redirect);
    }
    return navigateTo(homeRoute.value);
  }
});
