import { buildLoginRedirectUrl } from '@base/auth/utils/redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return;
  }

  const authStore = useAuthStore();
  const localePath = useLocalePath();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo(
      buildLoginRedirectUrl(localePath("/login"), to.fullPath),
    );
  }

  // Check if user has admin role
  if (!authStore.isAdmin) {
    return navigateTo(localePath("/app"));
  }

  // Check if token is valid and refresh if needed
  if (authStore.isTokenExpired) {
    try {
      const result = await authStore.refreshAccessToken();
      if (!result.success) {
        return navigateTo(
          buildLoginRedirectUrl(localePath("/login"), to.fullPath),
        );
      }
    } catch (error) {
      return navigateTo(
        buildLoginRedirectUrl(localePath("/login"), to.fullPath),
      );
    }
  }
});
