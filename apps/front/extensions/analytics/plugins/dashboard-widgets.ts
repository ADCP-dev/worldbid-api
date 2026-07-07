import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>('app:dashboards', () => []);

  const addAnalyticsDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'analytics')) return;
    dashboards.value.push({
      id: 'analytics',
      title: 'Analytics',
      componentName: 'AnalyticsDashboard',
      order: 0,
    });
  };

  addAnalyticsDashboard();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addAnalyticsDashboard();
    else dashboards.value = dashboards.value.filter(d => d.id !== 'analytics');
  });
});