<script setup lang="ts">
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
  </div>
</template>
