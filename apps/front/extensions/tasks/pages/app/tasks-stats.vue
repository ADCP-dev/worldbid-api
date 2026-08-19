<script setup lang="ts">
/**
 * Task Stats page — mounts the TaskStatsDashboard (lazy, client-only).
 *
 * Part of change `tasks-v2-professional` (Slice 7).
 */
definePageMeta({
  layout: 'default',
  middleware: ['auth'],
});
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold">Tasks</h1>
        <NuxtLink to="/app/tasks" class="btn btn-ghost btn-sm">← Board</NuxtLink>
      </div>
    </div>

    <!-- Dashboard (client-only: ECharts) -->
    <ClientOnly>
      <TaskStatsDashboard />
      <template #fallback>
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>