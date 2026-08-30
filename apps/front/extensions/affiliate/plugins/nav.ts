export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  // ─── Admin section (admins only) ────────────────────────────────────────
  const addAdminMenu = () => {
    if (!authStore.isAdmin) return;
    if (menuItems.value.find((item) => item.heading === 'ext.affiliate.nav.admin')) return;
    menuItems.value.push({
      heading: 'ext.affiliate.nav.admin',
      order: 30,
      items: [
        { title: 'ext.affiliate.nav.dashboard', icon: 'TrendingUp', link: '/app/affiliate', order: 0 },
        { title: 'ext.affiliate.nav.partners', icon: 'UserCheck', link: '/app/affiliate/partners', order: 10 },
        { title: 'ext.affiliate.nav.referrals', icon: 'Share2', link: '/app/affiliate/referrals', order: 20 },
        { title: 'ext.affiliate.nav.commissions', icon: 'Euro', link: '/app/affiliate/commissions', order: 30 },
      ],
    });
  };

  // ─── Portal section (affiliates only) ───────────────────────────────────
  const addPortalMenu = () => {
    if (!authStore.isAffiliate) return;
    if (menuItems.value.find((item) => item.heading === 'ext.affiliate.nav.portal')) return;
    menuItems.value.push({
      heading: 'ext.affiliate.nav.portal',
      order: 35,
      items: [
        { title: 'ext.affiliate.nav.dashboard', icon: 'LayoutDashboard', link: '/app/portal', order: 0 },
        { title: 'ext.affiliate.nav.pipeline', icon: 'GitBranch', link: '/app/portal/pipeline', order: 5 },
        { title: 'ext.affiliate.nav.myReferrals', icon: 'Share2', link: '/app/portal/referrals', order: 10 },
        { title: 'ext.affiliate.nav.myCommissions', icon: 'Euro', link: '/app/portal/commissions', order: 20 },
        { title: 'ext.affiliate.nav.myProfile', icon: 'User', link: '/app/portal/profile', order: 100 },
      ],
    });
  };

  addAdminMenu();
  addPortalMenu();

  watch(
    () => [authStore.isAdmin, authStore.isAffiliate],
    ([isAdmin, isAffiliate]) => {
      if (isAdmin) {
        addAdminMenu();
      } else {
        menuItems.value = menuItems.value.filter(item => item.heading !== 'ext.affiliate.nav.admin');
      }
      if (isAffiliate) {
        addPortalMenu();
      } else {
        menuItems.value = menuItems.value.filter(item => item.heading !== 'ext.affiliate.nav.portal');
      }
    },
  );
});