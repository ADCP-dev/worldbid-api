import { defineStore } from 'pinia'
import { useRouter } from 'vue-router'
import { authService } from '~/services/auth.service'

// Define the User interface
export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  avatar?: string
}

// Define the Authentication State interface
interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),
  
  getters: {
    // Return if the user is authenticated
    userIsAuthenticated: (state) => state.isAuthenticated,
    
    // Return if the user is an admin
    userIsAdmin: (state) => state.user?.role === 'admin',
    
    // Return the current user
    currentUser: (state) => state.user,
    
    // Return the authentication token
    authToken: (state) => state.token
  },
  
  actions: {
    /**
     * Login user with email and password
     */
    async login(email: string, password: string) {
      this.loading = true
      this.error = null
      
      try {
        // Use auth service to make the login request
        const response = await authService.login(email, password)
        
        // Set authentication data
        this.setAuthData(response.token, response.user)
        
        return true
      } catch (error: any) {
        this.error = error.message || 'Error durante el inicio de sesión'
        return false
      } finally {
        this.loading = false
      }
    },
    
    /**
     * Register a new user
     */
    async register(name: string, email: string, password: string) {
      this.loading = true
      this.error = null
      
      try {
        // Use auth service to make the register request
        const response = await authService.register(name, email, password)
        
        // Set authentication data
        this.setAuthData(response.token, response.user)
        
        return true
      } catch (error: any) {
        this.error = error.message || 'Error durante el registro'
        return false
      } finally {
        this.loading = false
      }
    },
    
    /**
     * Logout the current user
     */
    async logout() {
      this.loading = true
      
      try {
        // Call the logout API via auth service
        if (this.token) {
          await authService.logout(this.token)
        }
      } catch (error) {
        // Ignore errors during logout
        console.error('Error during logout:', error)
      } finally {
        // Clear local authentication data regardless of API response
        this.clearAuthData()
        this.loading = false
        
        // Navigate to login page
        navigateTo('/login')
      }
    },
    
    /**
     * Forgot password - sends password reset email
     */
    async forgotPassword(email: string) {
      this.loading = true
      this.error = null
      
      try {
        await authService.forgotPassword(email)
        
        return true
      } catch (error: any) {
        this.error = error.message || 'Error al enviar el correo de recuperación'
        return false
      } finally {
        this.loading = false
      }
    },
    
    /**
     * Reset password with token
     */
    async resetPassword(token: string, password: string) {
      this.loading = true
      this.error = null
      
      try {
        await authService.resetPassword(token, password)
        
        return true
      } catch (error: any) {
        this.error = error.message || 'Error al restablecer la contraseña'
        return false
      } finally {
        this.loading = false
      }
    },
    
    /**
     * Get current user profile
     */
    async fetchUserProfile() {
      if (!this.token) return
      
      this.loading = true
      
      try {
        const user = await authService.getUserProfile(this.token)
        
        this.user = user
        this.isAuthenticated = true
      } catch (error: any) {
        // If unauthorized, clear auth data
        if (error.message.includes('401') || error.message.includes('no autorizado')) {
          this.clearAuthData()
        }
        
        this.error = error.message || 'Error al obtener información del usuario'
      } finally {
        this.loading = false
      }
    },
    
    /**
     * Set authentication data after successful login/register
     */
    setAuthData(token: string, user: User) {
      this.token = token
      this.user = user
      this.isAuthenticated = true
      
      // Store token in localStorage for persistence (only in browser)
      if (process.client) {
        localStorage.setItem('auth_token', token)
      }
      
      // Set HTTP header for all future requests
      this.setAuthHeader(token)
    },
    
    /**
     * Clear authentication data on logout
     */
    clearAuthData() {
      this.token = null
      this.user = null
      this.isAuthenticated = false
      
      // Remove token from localStorage (only in browser)
      if (process.client) {
        localStorage.removeItem('auth_token')
      }
      
      // Remove auth header
      this.setAuthHeader(null)
    },
    
    /**
     * Set authorization header for API requests
     */
    setAuthHeader(token: string | null) {
      if (token) {
        // Set the default Authorization header for all fetch requests
        // You might need to adjust this depending on how you handle API requests
        $fetch.create({
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      }
    },
    
    /**
     * Initialize auth store - called on app startup
     */
    async init() {
      // Only try to get token from localStorage in browser environment
      if (process.client) {
        // Try to get token from localStorage
        const token = localStorage.getItem('auth_token')
        
        if (token) {
          this.token = token
          this.setAuthHeader(token)
          
          // Fetch user profile with the token
          await this.fetchUserProfile()
        }
      }
    }
  }
})
