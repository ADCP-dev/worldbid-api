import type { NavMenuGroup } from '../types';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenuGroup[]>('nav:menuItems', () => []);

  const addStripeMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Stripe')) return;
    menuItems.value.push({
      heading: 'Stripe',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/stripe' },
        { title: 'Products', icon: 'Package', link: '/app/stripe/products' },
        { title: 'Prices', icon: 'Tag', link: '/app/stripe/prices' },
        { title: 'Plans', icon: 'CreditCard', link: '/app/stripe/plans' },
        { title: 'Subscriptions', icon: 'Repeat', link: '/app/stripe/subscriptions' },
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