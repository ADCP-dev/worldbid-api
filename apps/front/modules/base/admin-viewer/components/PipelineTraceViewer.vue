<script setup lang="ts">
import { computed } from 'vue';
import type { SpecTrace, TraceStage } from '@base/admin-viewer/utils/mcp-types';

const props = defineProps<{ trace: SpecTrace | null }>();

const stages = computed<TraceStage[]>(() => props.trace?.stages ?? []);

const statusColor: Record<string, string> = {
  pass: 'text-success',
  fail: 'text-error',
  skipped: 'text-base-content/40',
};

const statusIcon: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  skipped: '○',
};
</script>

<template>
  <div v-if="stages.length === 0" class="text-base-content/50 py-4">
    No pipeline trace available.
  </div>
  <div v-else class="space-y-0">
    <div v-for="stage in stages" :key="stage.name" class="flex items-start gap-3 py-2">
      <span class="font-mono text-lg" :class="statusColor[stage.status] ?? ''">
        {{ statusIcon[stage.status] ?? '·' }}
      </span>
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm font-bold">{{ stage.name }}</span>
          <span class="font-mono text-xs text-base-content/50">{{ stage.duration }}ms</span>
        </div>
        <div v-if="stage.detail && Object.keys(stage.detail).length > 0" class="text-xs text-base-content/60 mt-1">
          {{ JSON.stringify(stage.detail) }}
        </div>
        <div v-if="stage.status === 'fail'" class="text-error text-sm mt-1">
          {{ (stage.detail as { error?: string })?.error ?? 'Failed' }}
        </div>
      </div>
    </div>
  </div>
</template>