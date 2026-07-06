export function useHomeRoute() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();
  const localePath = useLocalePath();

  /**
   * Resolves the home route based on the user's role.
   * This is used to determine where to redirect after login or when clicking the logo.
   */
  const resolveHomeRoute = (role?: { name?: string; homeRoute?: string } | null) => {
    // If no role is provided or user is not logged in, use the default app route
    if (!role) return localePath(config.public.mainAppRoute);

    // Decoupled: read homeRoute from the role object (seeded in DB)
    if (role.homeRoute) return localePath(role.homeRoute);

    return localePath(config.public.mainAppRoute);
  };

  // Reactive home route based on the current user's role
  const route = computed(() => resolveHomeRoute(authStore.user?.role));

  /**
   * Helper function to perform the navigation
   */
  const navigateHome = () => navigateTo(route.value);

  return { route, navigateHome, resolveHomeRoute };
}
