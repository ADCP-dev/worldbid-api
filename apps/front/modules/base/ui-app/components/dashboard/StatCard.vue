<script setup lang="ts">
import { computed } from 'vue'
import NumberFlow from '@number-flow/vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { StatCardProps } from '@base/ui-app/components/dashboard/types'

const props = withDefaults(defineProps<StatCardProps>(), {
  color: 'primary',
  loading: false,
})

const isNumber = computed(() => typeof props.value === 'number')

const trendColor = computed(() => {
  if (props.trend === undefined || props.trend === null) return ''
  return props.trend >= 0 ? 'text-success' : 'text-error'
})

const trendIcon = computed(() => {
  if (props.trend === undefined || props.trend === null) return null
  return props.trend >= 0 ? TrendingUp : TrendingDown
})

const trendLabel = computed(() => {
  if (props.trend === undefined || props.trend === null) return ''
  const sign = props.trend >= 0 ? '+' : ''
  return `${sign}${props.trend}%`
})

const cardClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'border-primary/30 bg-primary/5',
    secondary: 'border-secondary/30 bg-secondary/5',
    accent: 'border-accent/30 bg-accent/5',
    info: 'border-info/30 bg-info/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    error: 'border-error/30 bg-error/5',
  }
  return map[props.color] ?? map.primary
})

const iconWrapClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    accent: 'bg-accent/10 text-accent',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
  }
  return map[props.color] ?? map.primary
})
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300" :class="cardClass">
    <div class="card-body p-5 gap-2">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-base-content/70">
          {{ label }}
        </p>
        <div v-if="icon" class="rounded-lg p-2" :class="iconWrapClass">
          <component :is="icon" class="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div v-if="loading" class="flex items-center h-10">
        <span class="loading loading-spinner loading-md text-base-content/40" />
      </div>

      <div v-else class="flex items-baseline gap-1">
        <slot name="prefix" />
        <div class="text-3xl font-bold tracking-tight">
          <NumberFlow v-if="isNumber" :value="value as number" />
          <template v-else>{{ value }}</template>
        </div>
        <slot name="suffix" />
      </div>

      <div v-if="trend !== undefined" class="flex items-center gap-1 text-xs font-medium" :class="trendColor">
        <component :is="trendIcon" v-if="trendIcon" class="h-3 w-3" aria-hidden="true" />
        <span>{{ trendLabel }}</span>
      </div>

      <div v-if="$slots.footer" class="mt-1 pt-2 border-t border-base-200">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>