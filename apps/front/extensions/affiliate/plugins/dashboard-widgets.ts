export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<any[]>('app:dashboards', () => []);

  const addAffiliateDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'affiliate')) return;
    dashboards.value.push({
      id: 'affiliate',
      title: 'Afiliación',
      description: 'Partners, referencias y comisiones',
      icon: 'TrendingUp',
      link: '/app/affiliate',
      color: 'secondary',
    });
  };

  addAffiliateDashboard();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addAffiliateDashboard();
    else dashboards.value = dashboards.value.filter(d => d.id !== 'affiliate');
  });
});