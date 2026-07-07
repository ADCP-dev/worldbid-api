import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>(
    'app:dashboards',
    () => [],
  );

  const addAutonomousAgentDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'autonomous-agent')) return;
    dashboards.value.push({
      id: 'autonomous-agent',
      title: 'Autonomous Agent',
      componentName: 'AutonomousAgentDashboard',
      order: 80,
    });
  };

  addAutonomousAgentDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addAutonomousAgentDashboard();
      } else {
        dashboards.value = dashboards.value.filter((d) => d.id !== 'autonomous-agent');
      }
    },
  );
});