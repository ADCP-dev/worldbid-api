<script setup lang="ts">
import type { ExtensionView } from '@base/admin-viewer/utils/mcp-types';

defineProps<{ extension: ExtensionView }>();
</script>

<template>
  <div class="bg-base-100 rounded-box p-4 shadow flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <span class="font-mono font-bold text-sm">{{ extension.name }}</span>
      <span class="badge badge-xs badge-ghost">{{ extension.version }}</span>
    </div>
    <div class="text-xs text-base-content/60">
      {{ extension.resources.length }} resources · {{ extension.routes.length }} routes
    </div>
    <div class="flex gap-1 flex-wrap mt-1">
      <span v-if="extension.customRoles.length > 0" class="badge badge-xs badge-info">roles</span>
      <span v-if="extension.seeds" class="badge badge-xs badge-success">seeds</span>
      <span v-if="!extension.enabled" class="badge badge-xs badge-warning">disabled</span>
    </div>
  </div>
</template>