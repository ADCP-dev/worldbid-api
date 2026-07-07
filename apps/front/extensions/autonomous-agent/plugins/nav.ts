import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addAutonomousAgentMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Autonomous Agent')) return;
    menuItems.value.push({
      heading: 'Autonomous Agent',
      order: 80,
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/autonomous-agent', order: 0 },
        { title: 'Configs', icon: 'Settings', link: '/app/autonomous-agent/configs', order: 10 },
        { title: 'Runs', icon: 'Activity', link: '/app/autonomous-agent/runs', order: 20 },
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