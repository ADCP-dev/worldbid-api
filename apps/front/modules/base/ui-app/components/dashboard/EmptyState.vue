<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { Inbox } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    icon?: Component
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const iconComp = computed(() => props.icon ?? Inbox)

const sizeClasses = computed(() => {
  const map: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'py-6 px-4',
    md: 'py-12 px-6',
    lg: 'py-20 px-8',
  }
  return map[props.size]
})

const iconSize = computed(() => {
  const map: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }
  return map[props.size]
})

const titleSize = computed(() => {
  const map: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }
  return map[props.size]
})

const descSize = computed(() => {
  const map: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }
  return map[props.size]
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center gap-3"
    :class="sizeClasses"
    role="status"
  >
    <component
      :is="iconComp"
      class="text-base-content/40"
      :class="iconSize"
      aria-hidden="true"
    />
    <h3 class="font-semibold text-base-content/70" :class="titleSize">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="text-base-content/50 max-w-sm"
      :class="descSize"
    >
      {{ description }}
    </p>
    <slot name="action" />
    <slot />
  </div>
</template>