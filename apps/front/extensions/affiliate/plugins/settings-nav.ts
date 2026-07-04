export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const items = useState<{ title: string; href: string }[]>('settings:navItems', () => []);

  const addAffiliateSettings = () => {
    if (authStore.user?.role?.name !== 'affiliate') return;
    if (items.value.find(i => i.href === '/app/portal/profile')) return;
    items.value.push({ title: 'Mi perfil de afiliado', href: '/app/portal/profile' });
  };

  addAffiliateSettings();
  watch(() => authStore.user?.role?.name, (roleName) => {
    if (roleName === 'affiliate') {
      addAffiliateSettings();
    } else {
      items.value = items.value.filter(i => i.href !== '/app/portal/profile');
    }
  });
});