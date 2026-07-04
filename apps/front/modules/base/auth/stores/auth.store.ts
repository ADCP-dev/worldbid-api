import { defineStore } from 'pinia';
import { fetchWrapper } from '@/helpers/fetch-wrapper';

// Helper function to get base URL
const getBaseUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}/auth`;
};

interface User {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    name: string;
    homeRoute?: string;
  };
  photo?: {
    path: string;
  };
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  tokenExpires: number | null;
  user: User | null;
  refreshTokenTimeout: any;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    refreshToken: null,
    tokenExpires: null,
    user: null,
    refreshTokenTimeout: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    isTokenExpired: (state) => {
      if (!state.tokenExpires) return true;
      return Date.now() >= state.tokenExpires;
    },
    isAdmin: (state) => state.user?.role?.name === 'admin',
    isCustomer: (state) => state.user?.role?.name === 'customer',
    isAffiliate: (state) => state.user?.role?.name === 'affiliate',
    fullName: (state) => {
      if (!state.user) return '';
      return `${state.user.firstName} ${state.user.lastName}`.trim();
    },
  },
  actions: {
    async login(email: string, password: string) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(`${baseUrl}/email/login`, {
          email,
          password,
        });

        this.setAuthData(response);
        this.startRefreshTokenTimer();

        return { success: true };
      } catch (error: any) {
        const errorMessage = error.message || 'Login failed';
        let errorCode = undefined;

        if (error.data?.errors) {
          const firstErrorKey = Object.keys(error.data.errors)[0];
          if (firstErrorKey) {
            errorCode = error.data.errors[firstErrorKey];
          }
        }

        return { success: false, error: errorMessage, errorCode };
      }
    },

    async register(userData: any) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(
          `${baseUrl}/email/register`,
          userData,
        );
        return { success: true, data: response };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Registration failed',
        };
      }
    },

    async confirmEmail(hash: string) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(`${baseUrl}/email/confirm`, {
          hash,
        });
        return { success: true, data: response };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Email confirmation failed',
        };
      }
    },

    async resendConfirmation(email: string) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(
          `${baseUrl}/email/confirm/new`,
          { email },
        );
        return { success: true, data: response };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to resend confirmation',
        };
      }
    },

    async forgotPassword(email: string) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(`${baseUrl}/forgot/password`, {
          email,
        });
        return { success: true, data: response };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to send reset email',
        };
      }
    },

    async resetPassword(hash: string, password: string) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.post(`${baseUrl}/reset/password`, {
          hash,
          password,
        });
        return { success: true, data: response };
      } catch (error: unknown) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Password reset failed',
        };
      }
    },

    async getMe() {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.get(`${baseUrl}/me`);
        this.user = response;
        return { success: true, data: response };
      } catch (error: unknown) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get user data',
        };
      }
    },

    async updateProfile(userData: Record<string, unknown>) {
      try {
        const baseUrl = getBaseUrl();
        const response = await fetchWrapper.patch(`${baseUrl}/me`, userData);
        this.user = response;
        return { success: true, data: response };
      } catch (error: unknown) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to update profile',
        };
      }
    },

    async deleteAccount() {
      try {
        const baseUrl = getBaseUrl();
        await fetchWrapper.delete(`${baseUrl}/me`);
        this.logout();
        return { success: true };
      } catch (error: unknown) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to delete account',
        };
      }
    },

    async logout() {
      try {
        if (this.refreshToken) {
          const baseUrl = getBaseUrl();
          await fetchWrapper.post(`${baseUrl}/logout`, {
            refreshToken: this.refreshToken,
          });
        }
      } catch (error: unknown) {
        if (import.meta.dev) console.error('Logout error:', error);
      } finally {
        this.clearAuthData();
        if (import.meta.client) {
          window.location.href = '/login';
        }
      }
    },

    async refreshAccessToken() {
      try {
        if (!this.refreshToken) {
          throw new Error('No refresh token available');
        }

        const baseUrl = getBaseUrl();

        // Send refresh token in Authorization header as per API docs
        const response = await fetch(`${baseUrl}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.refreshToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Refresh failed: ${response.statusText} - ${errorText}`,
          );
        }

        const result = await response.json();

        // Add new tokens
        this.token = result.token;
        this.refreshToken = result.refreshToken;
        this.tokenExpires = result.tokenExpires;

        // Get user data
        const me = await this.getMe();
        if (me.success && me.data) {
          this.user = me.data as User;
        }

        // Start refresh token timer
        this.startRefreshTokenTimer();

        return { success: true, token: result.token };
      } catch (error: unknown) {
        if (import.meta.dev) console.error('Token refresh failed:', error);
        this.logout();
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Token refresh failed',
        };
      }
    },

    setAuthData(authData: {
      token: string;
      refreshToken: string;
      tokenExpires: number;
      user: User | null;
    }) {
      this.token = authData.token;
      this.refreshToken = authData.refreshToken;
      this.tokenExpires = authData.tokenExpires;
      this.user = authData.user;
    },

    clearAuthData() {
      this.token = null;
      this.refreshToken = null;
      this.tokenExpires = null;
      this.user = null;
      this.stopRefreshTokenTimer();
    },

    startRefreshTokenTimer() {
      this.stopRefreshTokenTimer();

      if (!this.tokenExpires) return;

      // Refresh token 1 minute before expiry
      const timeout = this.tokenExpires - Date.now() - 60 * 1000;

      if (timeout > 0) {
        this.refreshTokenTimeout = setTimeout(() => {
          this.refreshAccessToken();
        }, timeout);
      } else {
        // Token already expired, refresh immediately
        this.refreshAccessToken();
      }
    },

    stopRefreshTokenTimer() {
      if (this.refreshTokenTimeout) {
        clearTimeout(this.refreshTokenTimeout);
        this.refreshTokenTimeout = null;
      }
    },
  },
  persist: {
    paths: ['token', 'refreshToken', 'tokenExpires', 'user'],
  },
});
