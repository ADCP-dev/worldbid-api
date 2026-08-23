<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { TimelineEvent } from './types'
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue'

const props = withDefaults(
  defineProps<{
    events: TimelineEvent[]
    max?: number
    loading?: boolean
  }>(),
  { loading: false },
)

const { t } = useI18n()

const emptyIcon: Component = Clock

const COLOR_MAP: Record<string, string> = {
  primary: 'timeline-primary',
  secondary: 'timeline-secondary',
  accent: 'timeline-accent',
  neutral: 'timeline-neutral',
  info: 'timeline-info',
  success: 'timeline-success',
  warning: 'timeline-warning',
  error: 'timeline-error',
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : new Date(value)
}

function formatTime(value: Date | string): string {
  const date = toDate(value)
  if (!isValid(date)) return String(value)
  return format(date, "d 'de' MMMM, yyyy", { locale: es })
}

function formatTimeShort(value: Date | string): string {
  const date = toDate(value)
  if (!isValid(date)) return String(value)
  return format(date, 'HH:mm', { locale: es })
}

function timelineClass(color?: string): string {
  if (!color) return ''
  return COLOR_MAP[color] ?? ''
}

const visibleEvents = computed(() => {
  const sorted = [...props.events].sort((a, b) => {
    const ta = toDate(a.time).getTime()
    const tb = toDate(b.time).getTime()
    return tb - ta
  })
  return props.max ? sorted.slice(0, props.max) : sorted
})
</script>

<template>
  <div class="w-full">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <span class="loading loading-spinner loading-lg text-base-content/40" />
    </div>

    <EmptyState
      v-else-if="visibleEvents.length === 0"
      :icon="emptyIcon"
      :title="t('mod.ui.dashboard.timelineEmpty')"
      :description="t('mod.ui.dashboard.timelineEmptyDesc')"
      size="sm"
    />

    <ul v-else class="timeline timeline-vertical timeline-compact">
      <li v-for="(event, idx) in visibleEvents" :key="idx" class="timeline-item" :class="timelineClass(event.color)">
        <div class="timeline-start">
          <p class="text-xs text-base-content/60">{{ formatTime(event.time) }}</p>
          <p class="text-[10px] text-base-content/40">{{ formatTimeShort(event.time) }}</p>
        </div>
        <div class="timeline-middle">
          <component
            :is="event.icon ?? Clock"
            class="h-5 w-5"
            aria-hidden="true"
          />
        </div>
        <div class="timeline-end timeline-box mb-4 ml-auto w-full max-w-md">
          <h4 class="font-semibold text-sm">{{ event.title }}</h4>
          <p v-if="event.description" class="text-xs text-base-content/60 mt-1">
            {{ event.description }}
          </p>
        </div>
        <hr v-if="idx < visibleEvents.length - 1" />
      </li>
    </ul>
  </div>
</template>