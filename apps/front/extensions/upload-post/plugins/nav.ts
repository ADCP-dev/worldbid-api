import { watch } from 'vue';
import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);
  const authStore = useAuthStore();

  const HEADING = 'ext.upload-post.nav.heading';

  const addUploadPostMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === HEADING)) return;
    menuItems.value.push({
      heading: HEADING,
      order: 70,
      items: [
        { title: 'ext.upload-post.nav.dashboard', icon: 'LayoutDashboard', link: '/app/upload-post', order: 0 },
        { title: 'ext.upload-post.nav.compose', icon: 'PenLine', link: '/app/upload-post/compose', order: 10 },
        { title: 'ext.upload-post.nav.analytics', icon: 'BarChart3', link: '/app/upload-post/analytics', order: 20 },
        { title: 'ext.upload-post.nav.inbox', icon: 'Inbox', link: '/app/upload-post/inbox', order: 30 },
        { title: 'ext.upload-post.nav.queue', icon: 'ListOrdered', link: '/app/upload-post/queue', order: 40 },
        { title: 'ext.upload-post.nav.ideas', icon: 'Lightbulb', link: '/app/upload-post/ideas', order: 40 },
        { title: 'ext.upload-post.nav.settings', icon: 'Settings', link: '/app/upload-post/settings', order: 100 },
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