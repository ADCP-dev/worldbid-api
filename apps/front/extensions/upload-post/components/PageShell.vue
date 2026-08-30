<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import type { Component } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: Component;
    loading?: boolean;
  }>(),
  { subtitle: undefined, icon: undefined, loading: false },
);
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-4">
      <div v-if="props.icon" class="rounded-lg bg-primary/10 p-2 text-primary">
        <component :is="props.icon" class="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h1 class="text-xl font-bold">{{ props.title }}</h1>
        <p v-if="props.subtitle" class="text-sm text-base-content/60">
          {{ props.subtitle }}
        </p>
      </div>
    </div>
    <div v-if="props.loading" class="flex justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-base-content/40" aria-hidden="true" />
    </div>
    <slot v-else />
  </div>
</template>