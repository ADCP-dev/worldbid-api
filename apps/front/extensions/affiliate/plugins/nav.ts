import type { NavMenu } from '~/types/nav';

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  // ─── Admin section (admins only) ────────────────────────────────────────
  const addAdminMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'Afiliación')) return;
    menuItems.value.push({
      heading: 'Afiliación',
      order: 30,
      items: [
        { title: 'Dashboard', icon: 'TrendingUp', link: '/app/affiliate', order: 0 },
        { title: 'Partners', icon: 'UserCheck', link: '/app/affiliate/partners', order: 10 },
        { title: 'Referencias', icon: 'Share2', link: '/app/affiliate/referrals', order: 20 },
        { title: 'Comisiones', icon: 'Euro', link: '/app/affiliate/commissions', order: 30 },
      ],
    });
  };

  // ─── Portal section (affiliates only) ───────────────────────────────────
  const addPortalMenu = () => {
    if (authStore.user?.role?.name !== 'affiliate') return;
    if (menuItems.value.find((item) => item.heading === 'Portal')) return;
    menuItems.value.push({
      heading: 'Portal',
      order: 35,
      items: [
        { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/portal', order: 0 },
        { title: 'Mis referencias', icon: 'Share2', link: '/app/portal/referrals', order: 10 },
        { title: 'Mis comisiones', icon: 'Euro', link: '/app/portal/commissions', order: 20 },
        { title: 'Mi perfil', icon: 'User', link: '/app/portal/profile', order: 100 },
      ],
    });
  };

  addAdminMenu();
  addPortalMenu();

  watch(
    () => [authStore.isAdmin, authStore.user?.role?.name],
    ([isAdmin, roleName]) => {
      if (isAdmin) {
        addAdminMenu();
      } else {
        menuItems.value = menuItems.value.filter(item => item.heading !== 'Afiliación');
      }
      if (roleName === 'affiliate') {
        addPortalMenu();
      } else {
        menuItems.value = menuItems.value.filter(item => item.heading !== 'Portal');
      }
    },
  );
});