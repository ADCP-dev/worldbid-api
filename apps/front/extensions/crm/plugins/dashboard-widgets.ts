export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const widgets = useState<any[]>('app:dashboardWidgets', () => []);

  const addWidgets = () => {
    if (!authStore.isAdmin) return;
    if (widgets.value.find(w => w.id === 'crm-summary')) return;

    widgets.value.push({
      id: 'crm-summary',
      title: 'CRM',
      type: 'stat-cards',
      loadData: async () => {
        const crm = useCrm();
        const dash = await crm.getDashboard();
        return [
          { label: 'Total clientes', value: dash.totalClients ?? 0 },
          { label: 'Clientes activos', value: dash.activeClients ?? 0 },
          { label: 'Proyectos activos', value: dash.activeProjects ?? 0 },
        ];
      },
    });
  };

  addWidgets();
  watch(() => authStore.isAdmin, (isAdmin) => {
    if (isAdmin) addWidgets();
    else widgets.value = widgets.value.filter(w => w.id !== 'crm-summary');
  });
});