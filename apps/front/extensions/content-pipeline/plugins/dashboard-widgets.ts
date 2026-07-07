import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>('app:dashboards', () => []);

  const addContentPipelineDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find(d => d.id === 'content-pipeline')) return;
    dashboards.value.push({
      id: 'content-pipeline',
      title: 'Content Pipeline',
      componentName: 'ContentPipelineDashboard',
      order: 60,
    });
  };

  addContentPipelineDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addContentPipelineDashboard();
      } else {
        dashboards.value = dashboards.value.filter(
          (d) => d.id !== 'content-pipeline',
        );
      }
    },
  );
});