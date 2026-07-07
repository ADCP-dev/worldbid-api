import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addContentPipelineMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Content Pipeline')) return;
    menuItems.value.push({
      heading: 'Content Pipeline',
      order: 60,
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/content-pipeline', order: 0 },
        { title: 'Projects', icon: 'FolderKanban', link: '/app/content-pipeline/projects', order: 10 },
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