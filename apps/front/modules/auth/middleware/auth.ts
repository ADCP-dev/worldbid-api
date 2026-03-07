export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore();
  const localePath = useLocalePath();

  // If user is not authenticated, redirect to login
  if (!authStore.isAuthenticated) {
    return navigateTo(localePath("/login"));
  }

  // If token is expired, try to refresh it
  if (authStore.isTokenExpired) {
    // Let the fetch wrapper handle the token refresh automatically
    // If refresh fails, user will be redirected to login
    return;
  }
});
