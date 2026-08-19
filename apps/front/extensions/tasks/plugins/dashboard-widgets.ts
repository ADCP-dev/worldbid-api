import type { DashboardEntry } from '~/types/dashboard';

/**
 * Registers the Tasks dashboard tab on the main /app dashboard.
 * Adds a "Tasks" tab whose content is the compact TaskStatsWidget
 * (4 stat cards + tasks-by-status donut), surfaced alongside the
 * other extension dashboards.
 */
export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>('app:dashboards', () => []);

  const addTasksDashboard = () => {
    if (!authStore.isAuthenticated) return;
    if (dashboards.value.find((d) => d.id === 'tasks')) return;
    dashboards.value.push({
      id: 'tasks',
      title: 'Tasks',
      componentName: 'TaskStatsWidget',
      order: 20,
    });
  };

  addTasksDashboard();
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) addTasksDashboard();
      else dashboards.value = dashboards.value.filter((d) => d.id !== 'tasks');
    },
  );
});