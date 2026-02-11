import { defineStore } from 'pinia';

interface User {
  id: number;
  fullname: string;
  email: string;
  dni: string;
  // Add other user fields as needed
}

export const useActiveUserStore = defineStore('activeUser', {
  state: () => ({
    user: null as User | null,
    isVisible: false
  }),
  
  getters: {
    isActive: (state) => state.user !== null && state.isVisible,
    getUserId: (state) => state.user?.id || null,
    getUserFullname: (state) => state.user?.fullname || '',
    getUserEmail: (state) => state.user?.email || '',
    getUserDni: (state) => state.user?.dni || '',
  },
  
  actions: {
    setActiveUser(user: User) {
      this.user = user;
      this.isVisible = true;
    },
    
    clearActiveUser() {
      this.user = null;
      this.isVisible = false;
    },
    
    toggleVisibility() {
      this.isVisible = !this.isVisible;
    },
    
    // Call this method when navigating to a user edit page
    loadUserFromId(id: number) {
      // This would typically fetch the user data from an API
      // For now, we'll just set a placeholder user
      // Replace this with an actual API call in production
      this.setActiveUser({
        id,
        fullname: `User ${id}`,
        email: `user${id}@example.com`,
        dni: `${id}`.padStart(8, '0')
      });
    }
  },
  
  // Make the store persistent across page reloads
  persist: true
});
