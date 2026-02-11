import type { User } from '~/stores/auth'

// Authentication API response interfaces
interface AuthResponse {
  token: string
  user: User
}

interface ApiError {
  message: string
  statusCode: number
}

/**
 * Service to handle all authentication-related API calls
 */
export const authService = {
  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      return await $fetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  },

  /**
   * Register a new user
   */
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      return await $fetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password }
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  },

  /**
   * Logout the current user
   */
  async logout(token: string): Promise<void> {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    } catch (error: any) {
      // We don't throw on logout errors, just log them
      console.error('Error during logout:', error)
    }
  },

  /**
   * Send forgot password email
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      await $fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email }
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    try {
      await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password }
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  },

  /**
   * Get current user profile
   */
  async getUserProfile(token: string): Promise<User> {
    try {
      return await $fetch<User>('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  },

  /**
   * Handle API errors
   */
  handleError(error: any): Error {
    // Parse error message from API if available
    const apiError = error.data as ApiError | undefined
    
    if (apiError?.message) {
      return new Error(apiError.message)
    }
    
    // Handle network or other errors
    return new Error(error.message || 'Error de conexión con el servidor')
  }
}
