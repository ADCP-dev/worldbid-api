<script setup lang="ts">
import type { DashboardEntry } from '~/types/dashboard';
import { useOrderingStore } from '~/composables/useOrderingStore';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const config = useRuntimeConfig();
const store = useOrderingStore();
const extensionDashboards = useState<DashboardEntry[]>('app:dashboards', () => []);
const activeTab = ref<string>('');
const activatedTabs = ref<Set<string>>(new Set());

// Admin-configurable order: store override wins over plugin `order` defaults.
const sortedDashboards = computed(() =>
  store.effectiveDashboards(extensionDashboards.value),
);

// Pick the initial active tab: explicit runtimeConfig override wins,
// otherwise the lowest-order dashboard is the default landing tab.
function pickInitialTab(dashboards: DashboardEntry[]): string | null {
  if (dashboards.length === 0) return null;
  const override = config.public.defaultDashboard;
  if (override && dashboards.find(d => d.id === override)) {
    return override;
  }
  return dashboards[0].id;
}

// Set first tab as active when dashboards load
watch(sortedDashboards, (dashboards) => {
  if (dashboards.length > 0 && !dashboards.find(d => d.id === activeTab.value)) {
    const next = pickInitialTab(dashboards);
    if (next) {
      activeTab.value = next;
      activatedTabs.value.add(next);
    }
  }
}, { immediate: true, deep: true });

// Mark tab as activated the first time the user switches to it (lazy mount)
watch(activeTab, (tab) => {
  if (tab) activatedTabs.value.add(tab);
});
</script>

<template>
  <div class="p-6 space-y-6">
    <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>

    <!-- Loading gate: wait for ordering store to hydrate (first load only) -->
    <div v-if="!store.hydrated" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <div v-if="extensionDashboards.length === 0" class="text-center py-12">
        <p class="text-base-content/60">No hay dashboards de extensiones instalados.</p>
      </div>

      <template v-else>
        <!-- Tabs -->
        <div role="tablist" class="tabs tabs-bordered">
          <button
            v-for="dash in sortedDashboards"
            :key="dash.id"
            role="tab"
            class="tab"
            :class="{ 'tab-active': activeTab === dash.id }"
            @click="activeTab = dash.id"
          >
            {{ $t(dash.title) }}
          </button>
        </div>

        <!-- Tab content — lazy mount on first activation, stays alive after (v-show keeps data) -->
        <div v-for="dash in sortedDashboards" :key="dash.id" v-show="activeTab === dash.id">
          <component :is="resolveComponent(dash.componentName)" v-if="activatedTabs.has(dash.id)" />
        </div>
      </template>
    </template>
  </div>
</template>