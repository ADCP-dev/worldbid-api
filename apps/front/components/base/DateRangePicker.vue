<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { Calendar as CalendarIcon } from 'lucide-vue-next'

const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

const calendarDate = new CalendarDate(2024, 0, 20)

const value = ref({
  start: calendarDate,
  end: calendarDate.add({ days: 20 }),
}) as Ref<{ start: any; end: any }>

const startDateString = computed({
  get: () => {
    if (!value.value.start) return ""
    const d = value.value.start
    // @ts-ignore - access year, month, day
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  },
  set: (val: string) => {
    if (!val) {
      value.value.start = undefined
      return
    }
    const parts = val.split('-').map(Number)
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      value.value.start = new CalendarDate(parts[0], parts[1], parts[2])
    }
  }
})

const endDateString = computed({
  get: () => {
    if (!value.value.end) return ""
    const d = value.value.end
    // @ts-ignore - access year, month, day
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  },
  set: (val: string) => {
    if (!val) {
      value.value.end = undefined
      return
    }
    const parts = val.split('-').map(Number)
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      value.value.end = new CalendarDate(parts[0], parts[1], parts[2])
    }
  }
})
</script>

<template>
  <div class="dropdown dropdown-end">
    <label tabindex="0" class="btn btn-outline font-normal justify-start">
      <CalendarIcon class="mr-2 h-4 w-4" />
      <span v-if="value.start">
        <template v-if="value.end">
          {{ df.format(value.start.toDate(getLocalTimeZone())) }} - {{ df.format(value.end.toDate(getLocalTimeZone())) }}
        </template>
        <template v-else>
          {{ df.format(value.start.toDate(getLocalTimeZone())) }}
        </template>
      </span>
      <span v-else class="text-base-content/60">Pick a date</span>
    </label>
    <div tabindex="0" class="dropdown-content z-20 card card-compact w-72 p-4 shadow-xl bg-base-100 border border-base-300 gap-4 mt-2">
      <div class="flex flex-col gap-2">
        <label class="label p-0">
          <span class="label-text font-semibold text-xs uppercase opacity-60">Start Date</span>
        </label>
        <input v-model="startDateString" type="date" class="input input-bordered input-sm w-full" >
      </div>
      <div class="flex flex-col gap-2">
        <label class="label p-0">
          <span class="label-text font-semibold text-xs uppercase opacity-60">End Date</span>
        </label>
        <input v-model="endDateString" type="date" class="input input-bordered input-sm w-full" >
      </div>
    </div>
  </div>
</template>
