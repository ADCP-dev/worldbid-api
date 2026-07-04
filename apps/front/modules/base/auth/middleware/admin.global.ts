import { buildLoginRedirectUrl } from "@base/auth/utils/redirect";

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip server-side execution — auth uses localStorage which is client-only
  if (import.meta.server) {
    return;
  }

  // Only check app routes
  if (!to.path.startsWith("/app")) {
    return;
  }

  const authStore = useAuthStore();
  const localePath = useLocalePath();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo(buildLoginRedirectUrl(localePath("/login"), to.fullPath));
  }

  // Allow affiliate role to access /app/portal/*
  if (authStore.user?.role?.name === "affiliate" && to.path.startsWith("/app/portal")) {
    return; // Allow access
  }

  // Check if user has admin role
  if (!authStore.isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access Denied: Admin privileges required",
    });
  }

  // Check if token is valid and refresh if needed
  if (authStore.isTokenExpired) {
    try {
      const result = await authStore.refreshAccessToken();
      if (!result.success) {
        return navigateTo(buildLoginRedirectUrl(localePath("/login"), to.fullPath));
      }
    } catch (error) {
      return navigateTo(buildLoginRedirectUrl(localePath("/login"), to.fullPath));
    }
  }
});
