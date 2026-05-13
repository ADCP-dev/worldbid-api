import { buildLoginRedirectUrl } from '@base/auth/utils/redirect'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const localePath = useLocalePath();

  // If user is not authenticated, redirect to login preserving intended route
  if (!authStore.isAuthenticated) {
    return navigateTo(
      buildLoginRedirectUrl(localePath("/login"), to.fullPath),
    );
  }

  // If token is expired, try to refresh it
  if (authStore.isTokenExpired) {
    // Let the fetch wrapper handle the token refresh automatically
    // If refresh fails, user will be redirected to login
    return;
  }
});
