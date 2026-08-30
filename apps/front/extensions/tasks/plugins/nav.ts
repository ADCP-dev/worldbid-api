import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addTasksMenu = () => {
    if (!authStore.isAuthenticated) return;
    if (menuItems.value.find((item) => item.heading === 'ext.tasks.nav.heading')) return;
    menuItems.value.push({
      heading: 'ext.tasks.nav.heading',
      order: 15,
      items: [
        { title: 'ext.tasks.nav.board', icon: 'Kanban', link: '/app/tasks', order: 0 },
        { title: 'ext.tasks.nav.comments', icon: 'MessageSquare', link: '/app/tasks/comments', order: 10 },
        { title: 'ext.tasks.nav.activities', icon: 'Activity', link: '/app/tasks/activities', order: 20 },
      ],
    });
  };

  addTasksMenu();
  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (isAuth) {
      addTasksMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'ext.tasks.nav.heading');
    }
  });
});