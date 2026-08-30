import type { DashboardEntry } from '~/types/dashboard';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<DashboardEntry[]>(
    'app:dashboards',
    () => [],
  );

  const addUploadPostDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'upload-post')) return;
    dashboards.value.push({
      id: 'upload-post',
      title: 'Upload-Post',
      componentName: 'UploadPostDashboard',
      order: 70,
    });
  };

  addUploadPostDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addUploadPostDashboard();
      } else {
        dashboards.value = dashboards.value.filter((d) => d.id !== 'upload-post');
      }
    },
  );
});