export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();

  // Initialize auth state on app startup
  if (authStore.isAuthenticated) {
    // If token is expired or about to expire, refresh it
    if (authStore.isTokenExpired) {
      try {
        await authStore.refreshAccessToken();
      } catch (error) {
        console.error("Failed to refresh token on startup:", error);
        authStore.logout();
      }
    } else {
      // Start the refresh timer for valid tokens
      authStore.startRefreshTokenTimer();
    }

    // Fetch latest user data if we have a valid token
    if (authStore.isAuthenticated && !authStore.isTokenExpired) {
      try {
        await authStore.getMe();
      } catch (error) {
        console.error("Failed to fetch user data on startup:", error);
      }
    }
  }
});
