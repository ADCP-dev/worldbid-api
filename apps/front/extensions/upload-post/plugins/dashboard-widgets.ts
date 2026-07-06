export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<{ id: string; title: string; componentName: string }[]>(
    'app:dashboards',
    () => [],
  );

  const addUploadPostDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'upload-post')) return;
    dashboards.value.push({
      id: 'upload-post',
      title: 'Social Media',
      componentName: 'UploadPostDashboard',
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