import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>(
    'app:dashboards',
    () => [],
  );

  const addStripeDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'stripe')) return;
    dashboards.value.push({
      id: 'stripe',
      title: 'Billing',
      componentName: 'StripeDashboard',
      order: 20,
    });
  };

  addStripeDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addStripeDashboard();
      } else {
        dashboards.value = dashboards.value.filter((d) => d.id !== 'stripe');
      }
    },
  );
});