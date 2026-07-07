import type { NavMenu } from '~/types/nav';
import { watch } from 'vue';

export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);
  const localePath = useLocalePath();
  const authStore = useAuthStore();

  const addStorageMenu = () => {
    if (!authStore.isAdmin) return;
    if (!menuItems.value.find(item => item.heading === 'Storage')) {
      menuItems.value.push({
        heading: 'Storage',
        order: 95,
        items: [{
          title: 'Archivos',
          icon: 'FolderOpen',
          link: localePath('/app/storage'),
          order: 0,
        }],
      });
    }
  };

  addStorageMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addStorageMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'Storage');
    }
  });
});
