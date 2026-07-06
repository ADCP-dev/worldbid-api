import { watch } from 'vue';

export default defineNuxtPlugin(() => {
  const menuItems = useState<Array<{ heading: string; items: Array<{ title: string; icon: string; link: string }> }>>(
    'nav:menuItems',
    () => [],
  );
  const authStore = useAuthStore();

  const HEADING = 'Upload-Post';

  const addUploadPostMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === HEADING)) return;

    menuItems.value.push({
      heading: HEADING,
      items: [
        { title: 'Calendar', icon: 'Calendar', link: '/app/upload-post' },
        { title: 'Upload', icon: 'Upload', link: '/app/upload-post/upload' },
        { title: 'Queue', icon: 'ListOrdered', link: '/app/upload-post/queue' },
        { title: 'Platforms', icon: 'Share2', link: '/app/upload-post/platforms' },
        { title: 'Instagram', icon: 'Instagram', link: '/app/upload-post/instagram' },
        { title: 'Analytics', icon: 'BarChart3', link: '/app/upload-post/analytics' },
        { title: 'Monthly', icon: 'CalendarRange', link: '/app/upload-post/monthly' },
        { title: 'Ideas', icon: 'Lightbulb', link: '/app/upload-post/ideas' },
        { title: 'AutoDM', icon: 'MessageCircle', link: '/app/upload-post/autodms' },
        { title: 'Webhooks', icon: 'Webhook', link: '/app/upload-post/webhooks' },
      ],
    });
  };

  addUploadPostMenu();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addUploadPostMenu();
      } else {
        menuItems.value = menuItems.value.filter((item) => item.heading !== HEADING);
      }
    },
  );
});