export interface DashboardTab {
  id: string
  label: string
  icon?: string
  component?: any
  importFn?: () => Promise<any>
  order?: number
}

// Registry of component loaders (module-level, not serialized)
const componentRegistry = new Map<string, () => Promise<any>>()

export function useDashboardTabs() {
  // Store only serializable metadata in useState
  const tabMeta = useState<Array<{ id: string; label: string; icon?: string; order: number }>>('dashboard:tabs', () => [])

  const sortedTabs = computed(() =>
    [...tabMeta.value].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  )

  function registerTab(tab: DashboardTab) {
    if (!tabMeta.value.find(t => t.id === tab.id)) {
      tabMeta.value.push({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        order: tab.order ?? 100,
      })
      // Store the import function separately (never serialized)
      if (tab.importFn) {
        componentRegistry.set(tab.id, tab.importFn)
      }
    }
  }

  function getComponent(id: string): any {
    const loader = componentRegistry.get(id)
    return loader ? defineAsyncComponent(loader) : null
  }

  return { tabs: sortedTabs, registerTab, getComponent }
}
