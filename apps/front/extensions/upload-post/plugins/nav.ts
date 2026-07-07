import { watch } from 'vue';
import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>(
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
      order: 70,
      items: [
        { title: 'Calendar', icon: 'Calendar', link: '/app/upload-post', order: 0 },
        { title: 'Upload', icon: 'Upload', link: '/app/upload-post/upload', order: 10 },
        { title: 'Queue', icon: 'ListOrdered', link: '/app/upload-post/queue', order: 20 },
        { title: 'Platforms', icon: 'Share2', link: '/app/upload-post/platforms', order: 30 },
        { title: 'Instagram', icon: 'Instagram', link: '/app/upload-post/instagram', order: 40 },
        { title: 'Analytics', icon: 'BarChart3', link: '/app/upload-post/analytics', order: 50 },
        { title: 'Monthly', icon: 'CalendarRange', link: '/app/upload-post/monthly', order: 60 },
        { title: 'Ideas', icon: 'Lightbulb', link: '/app/upload-post/ideas', order: 70 },
        { title: 'AutoDM', icon: 'MessageCircle', link: '/app/upload-post/autodms', order: 80 },
        { title: 'Webhooks', icon: 'Webhook', link: '/app/upload-post/webhooks', order: 100 },
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