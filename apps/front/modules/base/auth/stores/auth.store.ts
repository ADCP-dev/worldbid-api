import { defineStore } from 'pinia'

interface User {
  id: string | number
  firstName: string
  lastName: string
  email: string
  role: { name: string }
  photo?: { path: string }
}

interface AuthData {
  token: string
  refreshToken: string
  tokenExpires: number
  user: User | null
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  tokenExpires: number | null
  user: User | null
  refreshTokenTimeout: ReturnType<typeof setTimeout> | null
}

/**
 * useAuthStore — Pinia store for authentication.
 *
 * Uses useApi() for all HTTP. The /auth/* endpoints are exempted from
 * the 401-refresh-then-retry logic in useApi() (via isAuthEndpoint guard),
 * so refresh can be called safely from this store.
 */
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
      if (!state.tokenExpires) return true
      return Date.now() >= state.tokenExpires
    },
    isAdmin: (state) => state.user?.role?.name === 'admin',
    isCustomer: (state) => state.user?.role?.name === 'customer',
    isAffiliate: (state) => state.user?.role?.name === 'affiliate',
    fullName: (state) =>
      state.user
        ? `${state.user.firstName} ${state.user.lastName}`.trim()
        : '',
  },
  actions: {
    async login(email: string, password: string) {
      try {
        const api = useApi()
        const response = await api.post<AuthData>('/auth/email/login', {
          email,
          password,
        })
        this.setAuthData(response)
        this.startRefreshTokenTimer()
        return { success: true }
      } catch (error: unknown) {
        const err = error as { message?: string; data?: { errors?: Record<string, string> } }
        const errorMessage = err.message || 'Login failed'
        const firstErrorKey = err.data?.errors
          ? Object.keys(err.data.errors)[0]
          : undefined
        const errorCode = firstErrorKey
          ? err.data?.errors?.[firstErrorKey]
          : undefined
        return { success: false, error: errorMessage, errorCode }
      }
    },

    async register(userData: Record<string, unknown>) {
      try {
        const api = useApi()
        const response = await api.post('/auth/email/register', userData)
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed',
        }
      }
    },

    async confirmEmail(hash: string) {
      try {
        const api = useApi()
        const response = await api.post('/auth/email/confirm', { hash })
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Email confirmation failed',
        }
      }
    },

    async resendConfirmation(email: string) {
      try {
        const api = useApi()
        const response = await api.post('/auth/email/confirm/new', { email })
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to resend confirmation',
        }
      }
    },

    async forgotPassword(email: string) {
      try {
        const api = useApi()
        const response = await api.post('/auth/forgot/password', { email })
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send reset email',
        }
      }
    },

    async resetPassword(hash: string, password: string) {
      try {
        const api = useApi()
        const response = await api.post('/auth/reset/password', {
          hash,
          password,
        })
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Password reset failed',
        }
      }
    },

    async getMe() {
      try {
        const api = useApi()
        const response = await api.get<User>('/auth/me')
        this.user = response
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get user data',
        }
      }
    },

    async updateProfile(userData: Record<string, unknown>) {
      try {
        const api = useApi()
        const response = await api.patch<User>('/auth/me', userData)
        this.user = response
        return { success: true, data: response }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update profile',
        }
      }
    },

    async deleteAccount() {
      try {
        const api = useApi()
        await api.delete('/auth/me')
        this.logout()
        return { success: true }
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete account',
        }
      }
    },

    async logout() {
      try {
        if (this.refreshToken) {
          const api = useApi()
          await api.post('/auth/logout', { refreshToken: this.refreshToken })
        }
      } catch (error: unknown) {
        console.error('Logout error:', error)
      } finally {
        this.clearAuthData()
        await navigateTo('/login')
      }
    },

    async refreshAccessToken() {
      try {
        if (!this.refreshToken) {
          throw new Error('No refresh token available')
        }
        const api = useApi()
        const result = await api.post<{
          token: string
          refreshToken: string
          tokenExpires: number
        }>('/auth/refresh', { refreshToken: this.refreshToken })

        this.token = result.token
        this.refreshToken = result.refreshToken
        this.tokenExpires = result.tokenExpires

        const me = await this.getMe()
        if (me.success && me.data) {
          this.user = me.data as User
        }

        this.startRefreshTokenTimer()
        return { success: true, token: result.token }
      } catch (error: unknown) {
        console.error('Token refresh failed:', error)
        this.logout()
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Token refresh failed',
        }
      }
    },

    setAuthData(authData: AuthData) {
      this.token = authData.token
      this.refreshToken = authData.refreshToken
      this.tokenExpires = authData.tokenExpires
      this.user = authData.user
    },

    clearAuthData() {
      this.token = null
      this.refreshToken = null
      this.tokenExpires = null
      this.user = null
      this.stopRefreshTokenTimer()
    },

    startRefreshTokenTimer() {
      this.stopRefreshTokenTimer()
      if (!this.tokenExpires) return
      const timeout = this.tokenExpires - Date.now() - 60 * 1000
      if (timeout > 0) {
        this.refreshTokenTimeout = setTimeout(() => {
          this.refreshAccessToken()
        }, timeout)
      } else {
        this.refreshAccessToken()
      }
    },

    stopRefreshTokenTimer() {
      if (this.refreshTokenTimeout) {
        clearTimeout(this.refreshTokenTimeout)
        this.refreshTokenTimeout = null
      }
    },
  },
  persist: true,
})