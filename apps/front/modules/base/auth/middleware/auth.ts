import { buildLoginRedirectUrl } from '@base/auth/utils/redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip server-side execution — auth uses localStorage which is client-only
  if (import.meta.server) return;

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
    try {
      const result = await authStore.refreshAccessToken();
      if (!result.success) {
        return navigateTo(buildLoginRedirectUrl(localePath("/login"), to.fullPath));
      }
    } catch {
      return navigateTo(buildLoginRedirectUrl(localePath("/login"), to.fullPath));
    }
  }
});
