export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<{ id: string; title: string; componentName: string }[]>(
    'app:dashboards',
    () => [],
  );

  const addCmsDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'cms')) return;
    dashboards.value.push({
      id: 'cms',
      title: 'CMS',
      componentName: 'CmsDashboard',
    });
  };

  addCmsDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addCmsDashboard();
      } else {
        dashboards.value = dashboards.value.filter((d) => d.id !== 'cms');
      }
    },
  );
});