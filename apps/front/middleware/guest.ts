export default defineNuxtRouteMiddleware(() => {
  const { route: homeRoute } = useHomeRoute();

  // If user is authenticated, redirect to home or dashboard
  const authStore = useAuthStore();
  if (authStore.isAuthenticated) {
    return navigateTo(homeRoute.value);
  }
});
