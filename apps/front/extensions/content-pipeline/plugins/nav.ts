export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<any[]>('nav:menuItems', () => []);

  const addContentPipelineMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Content Pipeline')) return;
    menuItems.value.push({
      heading: 'Content Pipeline',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/content-pipeline' },
        { title: 'Projects', icon: 'FolderKanban', link: '/app/content-pipeline/projects' },
      ],
    });
  };

  addContentPipelineMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addContentPipelineMenu();
      } else {
        menuItems.value = menuItems.value.filter(
          (item) => item.heading !== 'Content Pipeline',
        );
      }
    },
  );
});