import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addCrmMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'CRM')) return;
    menuItems.value.push({
      heading: 'CRM',
      order: 10,
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/crm', order: 0 },
        { title: 'Clientes', icon: 'Users', link: '/app/crm/clients', order: 10 },
        { title: 'Proyectos', icon: 'Briefcase', link: '/app/crm/projects', order: 20 },
        { title: 'Configuración', icon: 'Settings', link: '/app/crm/settings/statuses', order: 100 },
      ],
    });
  };

  addCrmMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addCrmMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'CRM');
    }
  });
});