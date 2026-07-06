<script setup lang="ts">
<<<<<<< HEAD
import { useDashboardTabs } from '@/composables/useDashboardTabs'

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
})

const { tabs, getComponent } = useDashboardTabs()
const activeTab = ref(tabs.value[0]?.id ?? '')

watchEffect(() => {
  if (!activeTab.value && tabs.value.length) {
    activeTab.value = tabs.value[0].id
  }
})

function tabComponent(id: string) {
  return getComponent(id)
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>
    </div>

    <!-- Tabs -->
    <div v-if="tabs.length > 1" class="tabs tabs-bordered">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{ 'tab-active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div v-for="tab in tabs" :key="tab.id" v-show="activeTab === tab.id">
      <component :is="tabComponent(tab.id)" />
    </div>
=======
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const extensionDashboards = useState<any[]>('app:dashboards', () => []);
const activeTab = ref<string>('');
const activatedTabs = ref<Set<string>>(new Set());

// Set first tab as active when dashboards load
watch(extensionDashboards, (dashboards) => {
  if (dashboards.length > 0 && !dashboards.find(d => d.id === activeTab.value)) {
    activeTab.value = dashboards[0].id;
    activatedTabs.value.add(dashboards[0].id);
  }
}, { immediate: true });

// Mark tab as activated the first time the user switches to it (lazy mount)
watch(activeTab, (tab) => {
  if (tab) activatedTabs.value.add(tab);
});
</script>

<template>
  <div class="p-6 space-y-6">
    <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>

    <div v-if="extensionDashboards.length === 0" class="text-center py-12">
      <p class="text-base-content/60">No hay dashboards de extensiones instalados.</p>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-bordered">
        <button
          v-for="dash in extensionDashboards"
          :key="dash.id"
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === dash.id }"
          @click="activeTab = dash.id"
        >
          {{ dash.title }}
        </button>
      </div>

      <!-- Tab content — lazy mount on first activation, stays alive after (v-show keeps data) -->
      <div v-for="dash in extensionDashboards" :key="dash.id" v-show="activeTab === dash.id">
        <component :is="dash.componentName" v-if="activatedTabs.has(dash.id)" />
      </div>
    </template>
>>>>>>> 3aded1db4c5a7ba899a388bdcca402c0f4116137
  </div>
</template>