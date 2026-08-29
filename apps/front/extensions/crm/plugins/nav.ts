import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addCrmMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'ext.crm.nav.crm')) return;
    menuItems.value.push({
      heading: 'ext.crm.nav.crm',
      order: 10,
      items: [
        { title: 'ext.crm.nav.dashboard', icon: 'LayoutDashboard', link: '/app/crm', order: 0 },
        { title: 'ext.crm.nav.clients', icon: 'Users', link: '/app/crm/clients', order: 10 },
        { title: 'ext.crm.nav.projects', icon: 'Briefcase', link: '/app/crm/projects', order: 20 },
        { title: 'ext.crm.settings.title', icon: 'Settings', link: '/app/crm/settings/statuses', order: 100 },
      ],
    });
  };

  addCrmMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addCrmMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'ext.crm.nav.crm');
    }
  });
});