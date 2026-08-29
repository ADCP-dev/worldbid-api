import { buildLoginRedirectUrl } from '@base/auth/utils/redirect'

/**
 * Affiliate-portal guard: allows only the `affiliate` role (plus `admin`,
 * which manages everything). Everything else is bounced out of the portal.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return;
  }

  const authStore = useAuthStore();
  const localePath = useLocalePath();

  if (!authStore.isAuthenticated) {
    return navigateTo(
      buildLoginRedirectUrl(localePath("/login"), to.fullPath),
    );
  }

  if (!authStore.isAffiliate && !authStore.isAdmin) {
    return navigateTo(localePath("/app"));
  }

  if (authStore.isTokenExpired) {
    try {
      const result = await authStore.refreshAccessToken();
      if (!result.success) {
        return navigateTo(
          buildLoginRedirectUrl(localePath("/login"), to.fullPath),
        );
      }
    } catch {
      return navigateTo(
        buildLoginRedirectUrl(localePath("/login"), to.fullPath),
      );
    }
  }
});