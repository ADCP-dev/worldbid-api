import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>('app:dashboards', () => []);

  const addAffiliateDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'affiliate')) return;
    dashboards.value.push({
      id: 'affiliate',
      title: 'Afiliación',
      componentName: 'AffiliateDashboard',
      order: 30,
    });
  };

  addAffiliateDashboard();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addAffiliateDashboard();
    else dashboards.value = dashboards.value.filter(d => d.id !== 'affiliate');
  });
});