<script setup lang="ts">
import clsx from 'clsx'
import { computed } from 'vue'

interface KbdProps {
  as?: string
  size?: 'xs' | 'sm' | 'md'
}

const props = withDefaults(defineProps<KbdProps>(), {
  as: 'kbd',
  size: 'sm',
})

const sizeClasses: Record<KbdProps['size'], string> = {
  xs: 'min-h-4 text-[10px] h-4 px-1',
  sm: 'min-h-5 text-[11px] h-5 px-1',
  md: 'min-h-6 text-[12px] h-6 px-1.5',
}

const kbdClass = computed(() =>
  clsx(
    'inline-flex items-center pointer-events-none min-w-5 h-5 select-none justify-center gap-1 rounded border border-border bg-muted font-sans font-medium',
    sizeClasses[props.size],
  ),
)
</script>

<template>
  <component :is="props.as" :class="kbdClass">
    <slot />
  </component>
</template>
