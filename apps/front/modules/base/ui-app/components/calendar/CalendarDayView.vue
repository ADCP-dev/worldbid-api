<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementBounding } from '@vueuse/core';
import type { CalendarEvent as CalendarEventType } from './types';
import { useCalendar } from './composables/useCalendar';
import CalendarEventChip from './CalendarEvent.vue';

const props = withDefaults(defineProps<{
  events: CalendarEventType[];
  currentDate: Date;
  hourStart?: number;
  hourEnd?: number;
  timeSlotHeight?: number;
  height?: string;
  snapMinutes?: number;
}>(), {
  hourStart: 0,
  hourEnd: 24,
  timeSlotHeight: 60,
  snapMinutes: 15,
});

const emit = defineEmits<{
  (e: 'event-click', event: CalendarEventType): void;
  (e: 'event-create', payload: { start: Date; end: Date; allDay: boolean }): void;
  (e: 'event-drop', payload: { event: CalendarEventType; newStart: Date; newEnd: Date }): void;
}>();

const { getHours, calculateEventStyle, formatDate, getEventsForDay } = useCalendar();

const hours = computed(() => getHours(props.hourStart, props.hourEnd));

const subdivisions = computed(() =>
  Array.from({ length: 1 }, (_, i) => i + 1) // 30-min lines
);

const dayEvents = computed(() => getEventsForDay(props.events, props.currentDate).filter(e => !e.allDay));
const allDayEvents = computed(() => getEventsForDay(props.events, props.currentDate).filter(e => e.allDay));

const gridRef = ref<HTMLElement>();
const { top: gridTop } = useElementBounding(gridRef);

const slotRefs = ref<Record<number, HTMLElement>>({});
const isDragActive = ref(false);
const hoveredSlot = ref<{ hour: number; minute: number } | null>(null);

function handleSlotClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const relativeY = event.clientY - rect.top;
  const totalMinutes = (relativeY / props.timeSlotHeight) * 60;
  const snappedMinutes = Math.floor(totalMinutes / props.snapMinutes) * props.snapMinutes;
  const hour = Math.floor(snappedMinutes / 60) + props.hourStart;
  const minute = snappedMinutes % 60;
  
  const start = new Date(props.currentDate);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);
  
  emit('event-create', { start, end, allDay: false });
}

function onDragStart() {
  isDragActive.value = true;
  document.addEventListener('pointermove', onDragPointerMove);
}

function onDragPointerMove(e: PointerEvent) {
  for (const [hourStr, slotEl] of Object.entries(slotRefs.value)) {
    const rect = slotEl.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const relativeY = e.clientY - rect.top;
      const minuteInSlot = (relativeY / props.timeSlotHeight) * 60;
      const snappedSlotMinutes = Math.floor(minuteInSlot / props.snapMinutes) * props.snapMinutes;
      const extraHours = Math.floor(snappedSlotMinutes / 60);
      const finalMinute = snappedSlotMinutes % 60;
      const finalHour = Number(hourStr) + extraHours;
      hoveredSlot.value = { hour: finalHour, minute: finalMinute };
      return;
    }
  }
  hoveredSlot.value = null;
}

function onDragEnd() {
  isDragActive.value = false;
  document.removeEventListener('pointermove', onDragPointerMove);
  // Don't clear hoveredSlot here — handleDragEnd uses it
}

function handleDragEnd(event: CalendarEventType, payload: { clientX: number; clientY: number }) {
  let newHour: number;
  let newMinute: number;

  if (hoveredSlot.value !== null) {
    newHour = hoveredSlot.value.hour;
    newMinute = hoveredSlot.value.minute;
  } else {
    if (!gridRef.value) return;
    const relativeY = payload.clientY - gridRef.value.getBoundingClientRect().top;
    const totalMinutes = (relativeY / props.timeSlotHeight) * 60;
    const snappedMinutes = Math.floor(totalMinutes / props.snapMinutes) * props.snapMinutes;
    newHour = Math.floor(snappedMinutes / 60) + props.hourStart;
    newMinute = snappedMinutes % 60;
  }

  const clampedHour = Math.max(props.hourStart, Math.min(props.hourEnd - 1, newHour));
  const clampedMinute = Math.max(0, Math.min(59, newMinute));
  const duration = event.end.getTime() - event.start.getTime();

  const newStart = new Date(props.currentDate);
  newStart.setHours(clampedHour, clampedMinute, 0, 0);
  const newEnd = new Date(newStart.getTime() + duration);

  emit('event-drop', { event, newStart, newEnd });
  hoveredSlot.value = null;
}
</script>

<template>
  <div class="flex flex-col" :style="{ height }">
    <!-- Day header -->
    <div class="border-b border-base-300 sticky top-0 bg-base-100 z-10 py-2 text-center">
      <div class="text-lg font-semibold">
        {{ formatDate(currentDate, 'EEEE d MMMM') }}
      </div>
    </div>

    <!-- All-day events bar -->
    <div v-if="allDayEvents.length" class="border-b border-base-300 p-2">
      <div class="text-xs text-base-content/50 mb-1">Todo el día</div>
      <CalendarEventChip
        v-for="event in allDayEvents"
        :key="event.id"
        :event="event"
        class="mb-0.5"
        @click="emit('event-click', event)"
        @drag-start="onDragStart"
        @drag-end="(payload) => { onDragEnd(); handleDragEnd(event, payload); }"
      />
    </div>

    <!-- Time grid -->
    <div ref="gridRef" class="flex flex-1 relative">
      <!-- Hour labels -->
      <div class="w-16 flex-shrink-0">
        <div
          v-for="hour in hours"
          :key="hour"
          class="text-xs text-base-content/50 text-right pr-2"
          :style="{ height: timeSlotHeight + 'px' }"
        >
          {{ String(hour).padStart(2, '0') }}:00
        </div>
      </div>

      <!-- Day column -->
      <div class="flex-1 border-l border-base-300 relative">
        <!-- Hour grid lines -->
        <div
          v-for="hour in hours"
          :key="hour"
          :ref="(el) => { if (el) slotRefs[hour] = el as HTMLElement }"
          class="border-t border-base-200 relative cursor-pointer hover:bg-base-200/50"
          :class="hoveredSlot && hoveredSlot.hour === hour ? 'ring-2 ring-primary ring-inset bg-primary/20' : ''"
          :style="{ height: timeSlotHeight + 'px' }"
          @click="handleSlotClick"
        >
          <div
            v-for="sub in subdivisions"
            :key="sub"
            class="absolute left-0 right-0 border-t border-base-200/50"
            :style="{ top: (sub * timeSlotHeight / (subdivisions.length + 1)) + 'px' }"
          />
        </div>

        <!-- Events -->
        <CalendarEventChip
          v-for="event in dayEvents"
          :key="event.id"
          :event="event"
          :style="{ position: 'absolute', left: '2px', right: '2px', ...calculateEventStyle(event, hourStart, timeSlotHeight) }"
          @click="emit('event-click', event)"
          @drag-start="onDragStart"
          @drag-end="(payload) => { onDragEnd(); handleDragEnd(event, payload); }"
        />
      </div>
    </div>
  </div>
</template>
