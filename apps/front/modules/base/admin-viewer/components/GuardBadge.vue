<script setup lang="ts">
import type { RouteView } from '@base/admin-viewer/utils/mcp-types';

const props = defineProps<{ guard: RouteView['guard'] }>();

const authLabel = computed(() => props.guard.auth.join(', ') || 'public');
const rolesLabel = computed(() => props.guard.roles.join(', ') || '-');
</script>

<template>
  <div class="flex flex-wrap gap-1 items-center">
    <span class="badge badge-sm badge-ghost font-mono">{{ authLabel }}</span>
    <span v-if="guard.roles.length > 0" class="badge badge-sm badge-info font-mono">
      {{ rolesLabel }}
    </span>
    <span v-if="guard.rowLevel" class="badge badge-sm badge-warning font-mono">row-level</span>
    <span v-if="guard.rateLimit?.enabled" class="badge badge-sm badge-success font-mono">
      rl:{{ guard.rateLimit.strategy }}
    </span>
  </div>
</template>