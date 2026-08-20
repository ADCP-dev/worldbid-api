<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ yaml: string }>();

const expanded = ref(false);
const lines = computed(() => props.yaml.split('\n'));
</script>

<template>
  <div class="bg-base-100 rounded-box border border-base-300">
    <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
      <span class="font-mono text-xs text-base-content/60">spec.yaml</span>
      <button class="btn btn-ghost btn-xs" @click="expanded = !expanded">
        {{ expanded ? 'Collapse' : 'Expand all' }}
      </button>
    </div>
    <pre
      class="font-mono text-sm p-3 overflow-x-auto bg-neutral text-neutral-content rounded-b-box"
      :class="expanded ? 'max-h-none' : 'max-h-64'"
    ><code>{{ yaml }}</code></pre>
  </div>
</template>