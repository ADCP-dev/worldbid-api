export default defineNuxtRouteMiddleware(async (to) => {
  // Only check app routes
  if (!to.path.startsWith("/app")) {
    return;
  }

  const authStore = useAuthStore();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo("/login?redirect=" + encodeURIComponent(to.fullPath));
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
        return navigateTo("/login?redirect=" + encodeURIComponent(to.fullPath));
      }
    } catch (error) {
      return navigateTo("/login?redirect=" + encodeURIComponent(to.fullPath));
    }
  }
});
