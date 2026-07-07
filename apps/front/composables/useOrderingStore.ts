import { defineStore } from 'pinia'
import type { DashboardEntry } from '~/types/dashboard'
import type { NavMenu } from '~/types/nav'

interface AppSettingResponse {
  id: string
  key: string
  value: Record<string, number> | null
  section?: string | null
}

interface OrderingState {
  dashboardOrder: Record<string, number> | null
  sidebarOrder: Record<string, number> | null
  hydrated: boolean
}

/**
 * useOrderingStore — Admin-configurable ordering for dashboards + sidebar groups.
 *
 * Persisted to localStorage via pinia-plugin-persistedstate. On first load
 * (no cache), `init()` awaits fetch → loading spinner in /app. On subsequent
 * loads, cache hydrates instantly → background revalidate.
 *
 * Backend contract:
 *   GET    /settings/ordering.dashboard → { id, key, value, section }
 *   PUT    /settings/ordering.dashboard  body { value: Record<id, number> }
 *   DELETE /settings/ordering.dashboard
 *
 * `null` override = use plugin `order` defaults.
 */
export const useOrderingStore = defineStore('ordering', {
  state: (): OrderingState => ({
    dashboardOrder: null,
    sidebarOrder: null,
    hydrated: false,
  }),
  persist: true,
  getters: {
    effectiveDashboards: (state) => (dashboards: DashboardEntry[]) => {
      return [...dashboards].sort((a, b) => {
        const ao = state.dashboardOrder?.[a.id] ?? a.order ?? 100
        const bo = state.dashboardOrder?.[b.id] ?? b.order ?? 100
        return ao - bo
      })
    },
    effectiveSidebarGroups: (state) => (groups: NavMenu[]) => {
      return [...groups].sort((a, b) => {
        const ak = a.heading ?? ''
        const bk = b.heading ?? ''
        const ao = state.sidebarOrder?.[ak] ?? a.order ?? 100
        const bo = state.sidebarOrder?.[bk] ?? b.order ?? 100
        return ao - bo
      })
    },
  },
  actions: {
    async init() {
      try {
        const api = useApi()
        const [dashRes, sideRes] = await Promise.all([
          api.get<AppSettingResponse | null>('/settings/ordering.dashboard').catch(() => null),
          api.get<AppSettingResponse | null>('/settings/ordering.sidebar').catch(() => null),
        ])
        if (dashRes && dashRes.value) this.dashboardOrder = dashRes.value
        if (sideRes && sideRes.value) this.sidebarOrder = sideRes.value
      } catch {
        // backend down — keep defaults (null = use plugin order)
      }
      this.hydrated = true
    },
    async saveDashboardOrder(order: Record<string, number>) {
      const api = useApi()
      await api.put<AppSettingResponse>('/settings/ordering.dashboard', { value: order })
      this.dashboardOrder = order
    },
    async saveSidebarOrder(order: Record<string, number>) {
      const api = useApi()
      await api.put<AppSettingResponse>('/settings/ordering.sidebar', { value: order })
      this.sidebarOrder = order
    },
    async resetDashboardOrder() {
      const api = useApi()
      await api.delete('/settings/ordering.dashboard').catch(() => {})
      this.dashboardOrder = null
    },
    async resetSidebarOrder() {
      const api = useApi()
      await api.delete('/settings/ordering.sidebar').catch(() => {})
      this.sidebarOrder = null
    },
  },
})