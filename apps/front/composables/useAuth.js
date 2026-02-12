export const useAuth = () => {
  const authStore = useAuthStore();
  
  return {
    // State
    user: computed(() => authStore.user),
    token: computed(() => authStore.token),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isAdmin: computed(() => authStore.isAdmin),
    userPermissions: computed(() => authStore.userPermissions),
    fullName: computed(() => authStore.fullName),
    
    // Actions
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
    confirmEmail: authStore.confirmEmail,
    resendConfirmation: authStore.resendConfirmation,
    forgotPassword: authStore.forgotPassword,
    resetPassword: authStore.resetPassword,
    getMe: authStore.getMe,
    updateProfile: authStore.updateProfile,
    deleteAccount: authStore.deleteAccount,
    refreshAccessToken: authStore.refreshAccessToken,
    
    // Permission helpers
    hasPermission: authStore.hasPermission,
    hasAnyPermission: authStore.hasAnyPermission,
    hasAllPermissions: authStore.hasAllPermissions,
  };
};
