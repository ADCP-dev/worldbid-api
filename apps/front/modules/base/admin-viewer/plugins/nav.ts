import type { NavMenu } from '~/types/nav';
import { watch } from 'vue';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addAdminViewerMenu = () => {
    if (
      authStore.isAdmin &&
      !menuItems.value.find((item) => item.heading === 'Admin')
    ) {
      menuItems.value.push({
        heading: 'Admin',
        order: 99,
        items: [
          { title: 'Overview', icon: 'LayoutDashboard', link: '/admin/overview', order: 0 },
          { title: 'Errors', icon: 'AlertCircle', link: '/admin/errors', order: 1 },
          { title: 'Extensions', icon: 'Boxes', link: '/admin/extensions', order: 2 },
          { title: 'Routes', icon: 'Route', link: '/admin/routes', order: 3 },

          { title: 'Specs', icon: 'FileCode', link: '/admin/specs', order: 5 },
        ],
      });
    }
  };

  addAdminViewerMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addAdminViewerMenu();
      }
    },
  );
});