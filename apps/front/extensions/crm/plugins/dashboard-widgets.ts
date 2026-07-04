export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<any[]>('app:dashboards', () => []);

  const addCrmDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'crm')) return;
    dashboards.value.push({
      id: 'crm',
      title: 'CRM',
      componentName: 'CrmDashboard',
    });
  };

  addCrmDashboard();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addCrmDashboard();
    else dashboards.value = dashboards.value.filter(d => d.id !== 'crm');
  });
});