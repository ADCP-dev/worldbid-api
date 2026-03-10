export function useHomeRoute() {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();
  const localePath = useLocalePath();

  /**
   * Resolves the home route based on the user's role.
   * This is used to determine where to redirect after login or when clicking the logo.
   */
  const resolveHomeRoute = (roleName?: string) => {
    // If no role is provided or user is not logged in, use the default app route
    if (!roleName) return localePath(config.public.mainAppRoute);

    // Mapping of roles to their respective dashboards/home pages
    const roleRoutes: Record<string, string> = {
      admin: config.public.mainAppRoute,
      customer: config.public.mainAppRoute,
      // Add more roles here as needed
      // staff: '/app/staff/dashboard',
    };

    return localePath(roleRoutes[roleName.toLowerCase()] || config.public.mainAppRoute);
  };

  // Reactive home route based on the current user's role
  const route = computed(() => resolveHomeRoute(authStore.user?.role?.name));

  /**
   * Helper function to perform the navigation
   */
  const navigateHome = () => navigateTo(route.value);

  return { route, navigateHome, resolveHomeRoute };
}
