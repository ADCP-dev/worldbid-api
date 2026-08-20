<script setup lang="ts">
defineProps<{
  changes: Array<{ file: string; before: string; after: string; diff: string }>;
}>();
</script>

<template>
  <div v-if="changes.length === 0" class="text-base-content/50 py-4">
    No file changes recorded.
  </div>
  <div v-else class="space-y-3">
    <div
      v-for="(change, i) in changes"
      :key="i"
      class="bg-base-100 rounded-box border border-base-300"
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        <span class="font-mono text-xs">{{ change.file }}</span>
      </div>
      <pre class="font-mono text-sm p-3 overflow-x-auto max-h-64 bg-neutral text-neutral-content rounded-b-box"><code>{{ change.diff || change.after }}</code></pre>
    </div>
  </div>
</template>