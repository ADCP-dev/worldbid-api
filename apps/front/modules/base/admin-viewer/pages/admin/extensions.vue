<script setup lang="ts">
import type { ExtensionView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const mcp = useMcp();

const { data: extensions } = await useAsyncData<ExtensionView[]>('admin-ext-list', () =>
  mcp.listExtensions(),
);

const filter = ref('');

const filtered = computed(() =>
  (extensions.value ?? []).filter((e) =>
    filter.value ? e.name.includes(filter.value) : true,
  ),
);
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Extensions</h1>

    <input
      v-model="filter"
      type="text"
      placeholder="Filter by name..."
      class="input input-bordered input-sm w-64 mb-4"
    />

    <div v-if="!extensions" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="filtered.length === 0" class="alert alert-info">
      <span>No extensions found.</span>
    </div>

    <div v-else class="overflow-x-auto bg-base-100 rounded-box shadow">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Routes</th>
            <th>Resources</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ext in filtered" :key="ext.name">
            <td class="font-mono font-bold">{{ ext.name }}</td>
            <td><span class="badge badge-xs badge-ghost">{{ ext.version }}</span></td>
            <td>{{ ext.routes.length }}</td>
            <td>{{ ext.resources.length }}</td>
            <td>
              <NuxtLink :to="`/admin/extensions/${ext.name}`" class="btn btn-xs btn-ghost">
                Detail →
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>