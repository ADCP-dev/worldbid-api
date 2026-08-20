<script setup lang="ts">
import type { ErrorView } from '@base/admin-viewer/utils/mcp-types';
import type { ErrorFilterState } from '@base/admin-viewer/components/ErrorFilters.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const mcp = useMcp();

const filters = ref<ErrorFilterState>({ category: '', extension: '', severity: '', resolved: '' });

async function fetchErrors() {
  return mcp.getErrors({
    ...(filters.value.category ? { category: filters.value.category } : {}),
    ...(filters.value.extension ? { extension: filters.value.extension } : {}),
    ...(filters.value.resolved === 'resolved' ? { resolved: true } : {}),
    ...(filters.value.resolved === 'unresolved' ? { resolved: false } : {}),
    limit: 50,
  });
}

const { data: errors, refresh } = await useAsyncData<ErrorView[]>('admin-errors', fetchErrors);

watch(filters, () => refresh(), { deep: true });

function severityBadge(sev?: string): string {
  if (sev === 'error') return 'badge-error';
  if (sev === 'warning') return 'badge-warning';
  if (sev === 'info') return 'badge-ghost';
  return 'badge-ghost';
}

function fmtDate(date?: string) {
  return date ? new Date(date).toLocaleString() : '-';
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Errors</h1>
      <button class="btn btn-ghost btn-sm" @click="refresh()">Refresh</button>
    </div>

    <AdminViewerErrorFilters v-model="filters" />

    <div v-if="!errors" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="errors.length === 0" class="alert alert-success">
      <span>No errors match the current filters.</span>
    </div>

    <div v-else class="overflow-x-auto bg-base-100 rounded-box shadow">
      <table class="table table-sm">
        <thead>
          <tr>
            <th></th>
            <th>Category</th>
            <th>Extension</th>
            <th>Message</th>
            <th>Severity</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="err in errors" :key="err.id">
            <td>
              <span v-if="err.resolved" class="badge badge-xs badge-success">●</span>
              <span v-else-if="err.severity === 'error'" class="badge badge-xs badge-error">●</span>
              <span v-else-if="err.severity === 'warning'" class="badge badge-xs badge-warning">●</span>
              <span v-else class="badge badge-xs badge-ghost">●</span>
            </td>
            <td class="font-mono text-xs">{{ err.category ?? '-' }}</td>
            <td class="font-mono text-xs">{{ err.extension ?? '-' }}</td>
            <td class="font-mono text-xs max-w-xs truncate">{{ err.message }}</td>
            <td>
              <span class="badge badge-xs" :class="severityBadge(err.severity)">
                {{ err.severity ?? '-' }}
              </span>
            </td>
            <td class="whitespace-nowrap text-xs">{{ fmtDate(err.createdAt) }}</td>
            <td>
              <NuxtLink :to="`/admin/errors/${err.id}`" class="btn btn-xs btn-ghost">View →</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>