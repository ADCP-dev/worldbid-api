<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

export interface ConfigSection {
  key: string;
  label: string;
  icon?: Component;
  url: string;
}

const props = defineProps<{
  sections: ConfigSection[];
  activeKey: string;
  title?: string;
  description?: string;
}>();

const route = useRoute();

const activeSection = computed(
  () =>
    props.sections.find((s) => s.key === props.activeKey) ??
    props.sections[0] ??
    null,
);

const isActive = (section: ConfigSection) =>
  section.key === props.activeKey || route.path === section.url;
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
    <aside class="hidden md:block">
      <div v-if="title || description" class="mb-4 px-2">
        <h2 v-if="title" class="text-sm font-bold uppercase tracking-wide text-base-content/70">
          {{ title }}
        </h2>
        <p v-if="description" class="text-xs text-base-content/50 mt-1">
          {{ description }}
        </p>
      </div>
      <ul class="menu menu-sm w-full gap-1">
        <li v-for="section in sections" :key="section.key">
          <NuxtLink
            :to="section.url"
            :class="{ active: isActive(section) }"
            class="flex items-center gap-3"
          >
            <component
              :is="section.icon"
              v-if="section.icon"
              :size="16"
              class="shrink-0"
            />
            <span class="truncate">{{ section.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </aside>

    <main class="min-w-0">
      <slot :active-section="activeSection" />
    </main>
  </div>
</template>