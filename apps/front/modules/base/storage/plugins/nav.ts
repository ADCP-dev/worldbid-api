import type { NavMenu } from '~/types/nav';
import { watch } from 'vue';

export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);
  const localePath = useLocalePath();
  const authStore = useAuthStore();

  const addStorageMenu = () => {
    if (!authStore.isAuthenticated) return;
    if (!menuItems.value.find(item => item.heading === 'Storage')) {
      menuItems.value.push({
        heading: 'Storage',
        items: [{
          title: 'Archivos',
          icon: 'FolderOpen',
          link: localePath('/app/storage'),
        }],
      });
    }
  };

  addStorageMenu();
  watch(() => authStore.isAuthenticated, addStorageMenu);
});
