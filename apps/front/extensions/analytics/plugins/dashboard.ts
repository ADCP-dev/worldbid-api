export default defineNuxtPlugin(() => {
  const { registerTab } = useDashboardTabs()

  registerTab({
    id: 'analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    order: 0,
    importFn: () => import('../components/analytics/AnalyticsDashboard.vue'),
  })
})
