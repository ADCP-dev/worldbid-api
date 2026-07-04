export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<any[]>('nav:menuItems', () => []);

  // ─── Admin section (admins only) ────────────────────────────────────────
  const addAdminMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Afiliación')) return;
    menuItems.value.push({
      heading: 'Afiliación',
      items: [
        { title: 'Dashboard', icon: 'TrendingUp', link: '/app/affiliate' },
        { title: 'Partners', icon: 'UserCheck', link: '/app/affiliate/partners' },
        { title: 'Referencias', icon: 'Share2', link: '/app/affiliate/referrals' },
        { title: 'Comisiones', icon: 'Euro', link: '/app/affiliate/commissions' },
      ],
    });
  };

  // ─── Portal section (affiliates only) ───────────────────────────────────
  const addPortalMenu = () => {
    if (authStore.user?.role?.name !== 'affiliate') return;
    if (menuItems.value.find((item) => item.heading === 'Portal')) return;
    menuItems.value.push({
      heading: 'Portal',
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/portal' },
        { title: 'Mis referencias', icon: 'Share2', link: '/app/portal/referrals' },
        { title: 'Mis comisiones', icon: 'Euro', link: '/app/portal/commissions' },
        { title: 'Mi perfil', icon: 'User', link: '/app/portal/profile' },
      ],
    });
  };

  addAdminMenu();
  addPortalMenu();

  watch(
    () => [authStore.isAdmin, authStore.user?.role?.name],
    () => {
      addAdminMenu();
      addPortalMenu();
    },
  );
});