export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<any[]>('nav:menuItems', () => []);

  const addCrmMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'CRM')) return;
    menuItems.value.push({
      heading: 'CRM',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/crm' },
        { title: 'Clientes', icon: 'Users', link: '/app/crm/clients' },
        { title: 'Configuración', icon: 'Settings', link: '/app/crm/settings/statuses' },
      ],
    });
  };

  addCrmMenu();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addCrmMenu();
  });
});