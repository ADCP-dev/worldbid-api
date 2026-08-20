<script setup lang="ts">
import { ref } from 'vue';
import type { ExtensionView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const mcp = useMcp();

const { data: extensions } = await useAsyncData<ExtensionView[]>('admin-specs-ext', () =>
  mcp.listExtensions(),
);

const selectedExt = ref('');
const selectedRes = ref('');
const yamlContent = ref<string | null>(null);
const loading = ref(false);

const resources = computed(() =>
  (extensions.value ?? []).find((e) => e.name === selectedExt.value)?.resources ?? [],
);

async function loadYaml() {
  if (!selectedExt.value || !selectedRes.value) return;
  loading.value = true;
  try {
    yamlContent.value = await mcp.getSpecYaml(selectedExt.value, selectedRes.value);
  } catch {
    yamlContent.value = null;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Specs</h1>

    <div class="flex gap-2 mb-4 items-end">
      <div>
        <label class="text-xs text-base-content/60">Extension</label>
        <select v-model="selectedExt" class="select select-bordered select-sm w-48" @change="selectedRes = ''">
          <option value="">Select...</option>
          <option v-for="e in extensions ?? []" :key="e.name" :value="e.name">{{ e.name }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-base-content/60">Resource</label>
        <select v-model="selectedRes" class="select select-bordered select-sm w-48" :disabled="!selectedExt">
          <option value="">Select...</option>
          <option v-for="r in resources" :key="r.name" :value="r.name">{{ r.name }}</option>
        </select>
      </div>
      <button class="btn btn-sm btn-primary" :disabled="!selectedExt || !selectedRes || loading" @click="loadYaml">
        Load YAML
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="yamlContent">
      <AdminViewerSpecYamlViewer :yaml="yamlContent" />
    </div>

    <div v-else class="alert alert-info">
      <span>Select an extension and resource to view its spec YAML.</span>
    </div>
  </div>
</template>