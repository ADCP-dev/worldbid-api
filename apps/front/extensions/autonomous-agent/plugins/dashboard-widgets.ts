export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const dashboards = useState<{ id: string; title: string; componentName: string }[]>(
    'app:dashboards',
    () => [],
  );

  const addAutonomousAgentDashboard = () => {
    if (!authStore.isAdmin) return;
    if (dashboards.value.find((d) => d.id === 'autonomous-agent')) return;
    dashboards.value.push({
      id: 'autonomous-agent',
      title: 'Autonomous Agent',
      componentName: 'AutonomousAgentDashboard',
    });
  };

  addAutonomousAgentDashboard();

  watch(
    () => authStore.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        addAutonomousAgentDashboard();
      } else {
        dashboards.value = dashboards.value.filter((d) => d.id !== 'autonomous-agent');
      }
    },
  );
});