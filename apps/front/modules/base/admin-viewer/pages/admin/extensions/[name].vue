<script setup lang="ts">
import { ref } from 'vue';
import type { ExtensionDetailView, ResourceDetailView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const mcp = useMcp();

const name = computed(() => String(route.params.name));

const { data: ext } = await useAsyncData<ExtensionDetailView>(
  () => `admin-ext-${name.value}`,
  () => mcp.getExtension(name.value),
);

const openResources = ref<Record<string, ResourceDetailView | undefined>>({});

async function toggleResource(resourceName: string) {
  if (openResources.value[resourceName]) {
    delete openResources.value[resourceName];
    return;
  }
  openResources.value[resourceName] = await mcp.getResource(name.value, resourceName);
}
</script>

<template>
  <div class="p-6">
    <NuxtLink to="/admin/extensions" class="btn btn-ghost btn-sm mb-4">← Back to Extensions</NuxtLink>

    <div v-if="!ext" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <template v-else>
      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-2xl font-bold font-mono">{{ ext.name }}</h1>
        <span class="badge badge-ghost">{{ ext.version }}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 class="text-lg font-bold mb-3">Spec files</h2>
          <div class="bg-base-100 rounded-box p-4 shadow space-y-1">
            <div v-for="f in ext.specFiles" :key="f" class="font-mono text-xs text-base-content/70">
              {{ f }}
            </div>
            <div v-if="ext.specFiles.length === 0" class="text-base-content/50 text-sm">None</div>
          </div>
        </div>

        <div>
          <h2 class="text-lg font-bold mb-3">Handlers</h2>
          <div class="bg-base-100 rounded-box p-4 shadow space-y-1">
            <div v-for="h in ext.handlers" :key="h.name" class="flex items-center gap-2">
              <span class="badge badge-xs badge-ghost">{{ h.type }}</span>
              <span class="font-mono text-xs">{{ h.name }}</span>
              <span class="font-mono text-xs text-base-content/50">{{ h.file }}</span>
            </div>
            <div v-if="ext.handlers.length === 0" class="text-base-content/50 text-sm">None</div>
          </div>
        </div>

        <div class="md:col-span-2">
          <h2 class="text-lg font-bold mb-3">Resources</h2>
          <div class="space-y-2">
            <div v-for="r in ext.resources" :key="r.name" class="bg-base-100 rounded-box shadow">
              <button
                class="w-full flex items-center justify-between p-3"
                @click="toggleResource(r.name)"
              >
                <span class="font-mono font-bold text-sm">{{ r.name }}</span>
                <span class="font-mono text-xs text-base-content/50">{{ r.table }}</span>
              </button>
              <div v-if="openResources[r.name]" class="border-t border-base-300 p-4">
                <div v-if="'fields' in (openResources[r.name] as ResourceDetailView)">
                  <h4 class="text-sm font-bold mb-2">Fields</h4>
                  <div class="overflow-x-auto">
                    <table class="table table-xs">
                      <thead>
                        <tr><th>Name</th><th>Type</th><th>Required</th><th>Nullable</th></tr>
                      </thead>
                      <tbody>
                        <tr v-for="f in (openResources[r.name] as ResourceDetailView).fields" :key="f.name">
                          <td class="font-mono">{{ f.name }}</td>
                          <td class="font-mono">{{ f.type }}</td>
                          <td>
                            <span v-if="f.required" class="badge badge-xs badge-error">req</span>
                          </td>
                          <td>
                            <span v-if="f.nullable" class="badge badge-xs badge-ghost">null</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 class="text-sm font-bold mt-4 mb-2">Hooks</h4>
                  <div class="space-y-1">
                    <div v-for="hk in (openResources[r.name] as ResourceDetailView).hooks" :key="hk.event" class="font-mono text-xs">
                      <span class="text-base-content/60">{{ hk.event }}</span> → {{ hk.handler }}
                    </div>
                    <div v-if="(openResources[r.name] as ResourceDetailView).hooks.length === 0" class="text-base-content/50 text-xs">None</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>