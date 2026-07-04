export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const widgets = useState<any[]>('app:dashboardWidgets', () => []);

  const addWidgets = () => {
    if (!authStore.isAdmin) return;
    if (widgets.value.find(w => w.id === 'affiliate-summary')) return;

    widgets.value.push({
      id: 'affiliate-summary',
      title: 'Afiliación',
      type: 'stat-cards',
      loadData: async () => {
        const affiliate = useAffiliate();
        const dash = await affiliate.getAffiliateDashboard();
        return [
          { label: 'Partners activos', value: dash.activePartners ?? 0 },
          { label: 'Referencias pendientes', value: dash.pendingReferrals ?? 0 },
          { label: 'Comisiones pendientes', value: `€${dash.pendingCommissionsTotal ?? 0}` },
          { label: 'Pagadas este mes', value: `€${dash.paidCommissionsThisMonth ?? 0}` },
        ];
      },
    });
  };

  addWidgets();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addWidgets();
    else widgets.value = widgets.value.filter(w => w.id !== 'affiliate-summary');
  });
});