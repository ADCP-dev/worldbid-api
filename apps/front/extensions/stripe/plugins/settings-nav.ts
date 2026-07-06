export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const items = useState<{ title: string; href: string }[]>('settings:navItems', () => []);

  const addSettings = () => {
    if (!authStore.isAdmin) return;

    // Stripe settings items (pages live in this extension layer)
    if (!items.value.find(i => i.href === '/app/settings/plan')) {
      items.value.push({ title: 'Suscripción', href: '/app/settings/plan' });
    }
    if (!items.value.find(i => i.href === '/app/settings/stripe-test')) {
      items.value.push({ title: 'Stripe Test', href: '/app/settings/stripe-test' });
    }
  };

  addSettings();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) {
      addSettings();
    } else {
      items.value = items.value.filter(i => i.href !== '/app/settings/plan' && i.href !== '/app/settings/stripe-test');
    }
  });
});