export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const widgets = useState<any[]>('crm:dashboardWidgets', () => []);

  const addWidgets = () => {
    if (!authStore.isAdmin) return;
    if (widgets.value.find(w => w.id === 'affiliate-in-crm')) return;

    widgets.value.push({
      id: 'affiliate-in-crm',
      title: 'Afiliación',
      type: 'stat-cards',
      loadData: async () => {
        const affiliate = useAffiliate();
        const dash = await affiliate.getAffiliateDashboard();
        return [
          { label: 'Partners activos', value: dash.activePartners ?? 0 },
          { label: 'Comisiones pendientes', value: `€${dash.pendingCommissionsTotal ?? 0}` },
        ];
      },
    });
  };

  addWidgets();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addWidgets();
    else widgets.value = widgets.value.filter(w => w.id !== 'affiliate-in-crm');
  });
});