import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  const addStripeMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Stripe')) return;
    menuItems.value.push({
      heading: 'Stripe',
      order: 20,
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/stripe', order: 0 },
        { title: 'Products', icon: 'Package', link: '/app/stripe/products', order: 10 },
        { title: 'Prices', icon: 'Tag', link: '/app/stripe/prices', order: 20 },
        { title: 'Plans', icon: 'CreditCard', link: '/app/stripe/plans', order: 30 },
        { title: 'Subscriptions', icon: 'Repeat', link: '/app/stripe/subscriptions', order: 40 },
      ],
    });
  };

  addStripeMenu();
  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addStripeMenu();
      } else {
        menuItems.value = menuItems.value.filter((item) => item.heading !== 'Stripe');
      }
    },
  );
});