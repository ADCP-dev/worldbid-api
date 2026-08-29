import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>('app:dashboards', () => []);

  const addCrmDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'crm')) return;
    dashboards.value.push({
      id: 'crm',
      title: 'ext.crm.nav.crm',
      componentName: 'CrmDashboard',
      order: 10,
    });
  };

  addCrmDashboard();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addCrmDashboard();
    else dashboards.value = dashboards.value.filter(d => d.id !== 'crm');
  });
});