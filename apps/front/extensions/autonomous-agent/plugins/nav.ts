export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<any[]>('nav:menuItems', () => []);

  const addAutonomousAgentMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Autonomous Agent')) return;
    menuItems.value.push({
      heading: 'Autonomous Agent',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/autonomous-agent' },
        { title: 'Configs', icon: 'Settings', link: '/app/autonomous-agent/configs' },
        { title: 'Runs', icon: 'Activity', link: '/app/autonomous-agent/runs' },
      ],
    });
  };

  addAutonomousAgentMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addAutonomousAgentMenu();
      } else {
        menuItems.value = menuItems.value.filter(
          (item) => item.heading !== 'Autonomous Agent',
        );
      }
    },
  );
});