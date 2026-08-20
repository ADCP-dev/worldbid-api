<script setup lang="ts">
import { ref } from 'vue';
import type { ErrorView, AutoFixLogView, SuggestedFixView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const mcp = useMcp();

const errorId = computed(() => String(route.params.id));

const { data: error } = await useAsyncData<ErrorView | null>(
  () => `admin-error-${errorId.value}`,
  async () => {
    const rows = await mcp.getErrors({ limit: 50 });
    return rows.find((e) => String(e.id) === errorId.value) ?? null;
  },
);

const { data: autoFixes } = await useAsyncData<AutoFixLogView[]>(
  () => `admin-error-fixes-${errorId.value}`,
  () => mcp.listAutoFixes({ errorId: errorId.value, limit: 10 }),
);

const activeTab = ref<'stack' | 'trace' | 'fix' | 'spec' | 'raw'>('stack');

const suggestedFix = computed<SuggestedFixView | null>(() => {
  const fixes = error.value?.suggestedFixes;
  return fixes && fixes.length > 0 ? fixes[0] : null;
});

function fmtDate(date?: string) {
  return date ? new Date(date).toLocaleString() : '-';
}
</script>

<template>
  <div class="p-6">
    <NuxtLink to="/admin/errors" class="btn btn-ghost btn-sm mb-4">← Back to Errors</NuxtLink>

    <div v-if="!error" class="alert alert-error">
      <span>Error not found.</span>
    </div>

    <template v-else>
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-1">
          <span class="badge badge-sm badge-ghost">{{ error.category ?? '-' }}</span>
          <span v-if="error.severity" class="badge badge-sm" :class="error.severity === 'error' ? 'badge-error' : 'badge-warning'">
            {{ error.severity }}
          </span>
          <span v-if="error.extension" class="badge badge-sm badge-info">{{ error.extension }}</span>
        </div>
        <h1 class="text-xl font-mono font-bold">{{ error.message }}</h1>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 text-sm">
        <div class="bg-base-100 rounded-box p-2">
          <div class="text-xs text-base-content/60">Created</div>
          <div class="font-mono text-xs">{{ fmtDate(error.createdAt) }}</div>
        </div>
        <div class="bg-base-100 rounded-box p-2">
          <div class="text-xs text-base-content/60">Resolved</div>
          <div>
            <span v-if="error.resolved" class="badge badge-xs badge-success">yes</span>
            <span v-else class="badge badge-xs badge-error">no</span>
          </div>
        </div>
        <div class="bg-base-100 rounded-box p-2">
          <div class="text-xs text-base-content/60">ID</div>
          <div class="font-mono text-xs">{{ error.id }}</div>
        </div>
        <div class="bg-base-100 rounded-box p-2">
          <div class="text-xs text-base-content/60">Extension</div>
          <div class="font-mono text-xs">{{ error.extension ?? '-' }}</div>
        </div>
      </div>

      <div role="tablist" class="tabs tabs-bordered mb-4">
        <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'stack' }" @click="activeTab = 'stack'">Stack Trace</a>
        <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'trace' }" @click="activeTab = 'trace'">Pipeline Trace</a>
        <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'fix' }" @click="activeTab = 'fix'">Fix</a>
        <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'spec' }" @click="activeTab = 'spec'">Spec</a>
        <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'raw' }" @click="activeTab = 'raw'">Raw</a>
      </div>

      <div v-if="activeTab === 'stack'" class="bg-base-100 rounded-box p-4 shadow">
        <AdminViewerStackTraceViewer v-if="error.stack" :stack="error.stack" />
        <div v-else class="text-base-content/50">No stack trace.</div>
      </div>

      <div v-else-if="activeTab === 'trace'" class="bg-base-100 rounded-box p-4 shadow">
        <AdminViewerPipelineTraceViewer :trace="null" />
      </div>

      <div v-else-if="activeTab === 'fix'" class="space-y-4">
        <div v-if="suggestedFix" class="bg-base-100 rounded-box p-4 shadow">
          <h3 class="font-bold mb-2">Suggested Fix (confidence: {{ suggestedFix.confidence }})</h3>
          <div class="space-y-1 text-sm">
            <div><span class="text-base-content/60">Type:</span> <span class="font-mono">{{ suggestedFix.type }}</span></div>
            <div v-if="suggestedFix.description"><span class="text-base-content/60">Description:</span> {{ suggestedFix.description }}</div>
            <div v-if="suggestedFix.target"><span class="text-base-content/60">Target:</span> <span class="font-mono">{{ suggestedFix.target }}</span></div>
            <div v-if="suggestedFix.field"><span class="text-base-content/60">Field:</span> <span class="font-mono">{{ suggestedFix.field }}</span></div>
          </div>
          <div class="flex gap-2 mt-4">
            <button class="btn btn-sm btn-success">Apply Fix</button>
            <button class="btn btn-sm btn-outline">Create PR</button>
            <button class="btn btn-sm btn-ghost">Dismiss</button>
          </div>
        </div>
        <div v-else class="alert alert-info">
          <span>No suggested fix for this error.</span>
        </div>

        <div v-if="autoFixes && autoFixes.length > 0" class="bg-base-100 rounded-box p-4 shadow">
          <h3 class="font-bold mb-2">Auto-fix history</h3>
          <div class="space-y-2">
            <div v-for="fix in autoFixes" :key="fix.id" class="text-sm border-b border-base-300 pb-2">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs">{{ fmtDate(fix.createdAt) }}</span>
                <span class="badge badge-xs" :class="fix.status === 'applied' ? 'badge-success' : 'badge-ghost'">{{ fix.status }}</span>
                <span class="badge badge-xs badge-info">{{ fix.fixType }} ({{ fix.confidence }})</span>
              </div>
              <div v-if="fix.reason" class="text-xs text-base-content/60 mt-1">{{ fix.reason }}</div>
              <NuxtLink v-if="fix.prUrl" :to="fix.prUrl" class="link link-primary text-xs">PR →</NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'spec'" class="bg-base-100 rounded-box p-4 shadow">
        <p v-if="!error.extension" class="text-base-content/50">No extension associated.</p>
        <p v-else class="text-base-content/50">Spec viewer for {{ error.extension }} — select a resource to view its YAML.</p>
      </div>

      <div v-else class="bg-base-100 rounded-box p-4 shadow">
        <details>
          <summary class="cursor-pointer font-mono text-sm text-base-content/60">Full JSON</summary>
          <pre class="font-mono text-xs mt-3 overflow-x-auto"><code>{{ JSON.stringify(error, null, 2) }}</code></pre>
        </details>
      </div>
    </template>
  </div>
</template>