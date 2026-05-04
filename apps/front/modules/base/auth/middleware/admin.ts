export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    return;
  }

  const authStore = useAuthStore();
  const localePath = useLocalePath();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo(localePath("/login"));
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
        return navigateTo(localePath("/login"));
      }
    } catch (error) {
      return navigateTo(localePath("/login"));
    }
  }
});
