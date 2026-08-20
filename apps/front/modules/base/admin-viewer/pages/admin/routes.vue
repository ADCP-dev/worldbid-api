<script setup lang="ts">
import { ref } from 'vue';
import type { RouteView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const mcp = useMcp();

const { data: routes } = await useAsyncData<RouteView[]>('admin-routes', () =>
  mcp.listRoutes(),
);

const methodFilter = ref('');
const extensionFilter = ref('');

const filtered = computed(() =>
  (routes.value ?? []).filter((r) => {
    if (methodFilter.value && r.method !== methodFilter.value) return false;
    if (extensionFilter.value && r.extension !== extensionFilter.value) return false;
    return true;
  }),
);

const methods = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Routes</h1>

    <div class="flex gap-2 mb-4">
      <select v-model="methodFilter" class="select select-bordered select-sm">
        <option v-for="m in methods" :key="m" :value="m">{{ m || 'All methods' }}</option>
      </select>
      <input
        v-model="extensionFilter"
        type="text"
        placeholder="Extension"
        class="input input-bordered input-sm w-32"
      />
    </div>

    <div v-if="!routes" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="filtered.length === 0" class="alert alert-info">
      <span>No routes match filters.</span>
    </div>

    <div v-else class="overflow-x-auto bg-base-100 rounded-box shadow">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Extension</th>
            <th>Operation</th>
            <th>Guard</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="`${r.method}-${r.path}`">
            <td>
              <span
                class="badge badge-sm font-mono"
                :class="{
                  'badge-info': r.method === 'GET',
                  'badge-success': r.method === 'POST',
                  'badge-warning': r.method === 'PUT' || r.method === 'PATCH',
                  'badge-error': r.method === 'DELETE',
                }"
              >
                {{ r.method }}
              </span>
            </td>
            <td class="font-mono text-xs">{{ r.path }}</td>
            <td class="font-mono text-xs">{{ r.extension ?? r.module ?? '-' }}</td>
            <td class="font-mono text-xs">{{ r.operation }}</td>
            <td><AdminViewerGuardBadge :guard="r.guard" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>