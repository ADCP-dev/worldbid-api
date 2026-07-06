export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<{ id: string; title: string; componentName: string }[]>(
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