import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addTasksMenu = () => {
    if (!authStore.isAuthenticated) return;
    if (menuItems.value.find((item) => item.heading === 'TASKS')) return;
    menuItems.value.push({
      heading: 'TASKS',
      order: 15,
      items: [
        { title: 'Board', icon: 'Kanban', link: '/app/tasks', order: 0 },
        { title: 'Comments', icon: 'MessageSquare', link: '/app/tasks/comments', order: 10 },
        { title: 'Activity', icon: 'Activity', link: '/app/tasks/activities', order: 20 },
      ],
    });
  };

  addTasksMenu();
  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (isAuth) {
      addTasksMenu();
    } else {
      menuItems.value = menuItems.value.filter(item => item.heading !== 'TASKS');
    }
  });
});