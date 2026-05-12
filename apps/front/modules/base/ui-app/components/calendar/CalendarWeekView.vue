<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementBounding } from '@vueuse/core';
import type { CalendarEvent as CalendarEventType } from './types';
import { useCalendar } from './composables/useCalendar';
import CalendarEventChip from './CalendarEvent.vue';

const props = withDefaults(defineProps<{
  events: CalendarEventType[];
  currentDate: Date;
  firstDayOfWeek?: number;
  hourStart?: number;
  hourEnd?: number;
  timeSlotHeight?: number;
  height?: string;
  snapMinutes?: number;
}>(), {
  firstDayOfWeek: 1,
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

const { generateWeekGrid, getHours, calculateEventStyle, detectOverlaps, formatDate, getEventsForDay } = useCalendar();

const weekDays = computed(() => generateWeekGrid(props.currentDate, props.firstDayOfWeek));
const hours = computed(() => getHours(props.hourStart, props.hourEnd));

// Compute column layout for overlapping events per day
const dayEventColumns = computed(() => {
  const map = new Map<string, Map<string, { columnIndex: number; totalColumns: number }>>();
  for (const day of weekDays.value) {
    const dayEvents = getDayEvents(props.events, day);
    const columns = detectOverlaps(dayEvents);
    map.set(day.toISOString(), columns);
  }
  return map;
});

function getEventStyle(event: CalendarEventType, day: Date): Record<string, string> {
  const base = calculateEventStyle(event, props.hourStart, props.timeSlotHeight);
  const columns = dayEventColumns.value.get(day.toISOString())?.get(event.id);
  const colIdx = columns?.columnIndex ?? 0;
  const total = columns?.totalColumns ?? 1;

  if (total <= 1) {
    return {
      position: 'absolute',
      top: base.top,
      height: base.height,
      left: '2px',
      right: '2px',
    };
  }

  const gap = 2;
  const leftPx = colIdx > 0 ? `calc(${(colIdx / total) * 100}% + ${gap}px)` : `${gap}px`;
  const rightPx = colIdx < total - 1
    ? `calc(${((total - colIdx - 1) / total) * 100}% + ${gap}px)`
    : `${gap}px`;

  return {
    position: 'absolute',
    top: base.top,
    height: base.height,
    left: leftPx,
    right: rightPx,
  };
}

const subdivisions = computed(() =>
  Array.from({ length: 1 }, (_, i) => i + 1) // 30-min lines
);

const gridRef = ref<HTMLElement>();
const { left: gridLeft, top: gridTop, width: gridWidth } = useElementBounding(gridRef);

const slotRefs = ref<Record<string, HTMLElement>>({});
const isDragActive = ref(false);
const hoveredSlot = ref<{ day: string; startHour: number; startMinute: number } | null>(null);

function getDayEvents(events: CalendarEventType[], day: Date) {
  return getEventsForDay(events, day).filter(e => !e.allDay);
}

function getAllDayEvents(events: CalendarEventType[], day: Date) {
  return getEventsForDay(events, day).filter(e => e.allDay);
}

function handleSlotClick(day: Date, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const relativeY = event.clientY - rect.top;
  const totalMinutes = (relativeY / props.timeSlotHeight) * 60;
  const snappedMinutes = Math.floor(totalMinutes / props.snapMinutes) * props.snapMinutes;
  const hour = Math.floor(snappedMinutes / 60) + props.hourStart;
  const minute = snappedMinutes % 60;
  
  const start = new Date(day);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60); // Default 1-hour event
  
  emit('event-create', { start, end, allDay: false });
}

function onDragStart() {
  isDragActive.value = true;
  document.addEventListener('pointermove', onDragPointerMove);
}

function onDragPointerMove(e: PointerEvent) {
  for (const [key, slotEl] of Object.entries(slotRefs.value)) {
    const rect = slotEl.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const [dayStr, hourStr] = key.split('||');
      const relativeY = e.clientY - rect.top;
      const minuteInSlot = (relativeY / props.timeSlotHeight) * 60;
      const snappedSlotMinutes = Math.floor(minuteInSlot / props.snapMinutes) * props.snapMinutes;
      const extraHours = Math.floor(snappedSlotMinutes / 60);
      const finalMinute = snappedSlotMinutes % 60;
      const finalHour = Number(hourStr) + extraHours;
      hoveredSlot.value = { day: dayStr || '', startHour: finalHour, startMinute: finalMinute };
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
  if (!gridRef.value) return;

  const gridRect = gridRef.value.getBoundingClientRect();
  const relativeY = payload.clientY - gridRect.top;
  const relativeX = payload.clientX - gridRect.left;

  const totalMinutes = (relativeY / props.timeSlotHeight) * 60;
  const snappedMinutes = Math.floor(totalMinutes / props.snapMinutes) * props.snapMinutes;
  const newHour = Math.floor(snappedMinutes / 60) + props.hourStart;
  const newMinute = snappedMinutes % 60;
  const clampedHour = Math.max(props.hourStart, Math.min(props.hourEnd - 1, newHour));
  const clampedMinute = Math.max(0, Math.min(59, newMinute));

  const dayIndex = Math.floor(relativeX / (gridRect.width / 7));
  const clampedDayIndex = Math.max(0, Math.min(6, dayIndex));
  const targetDay = weekDays.value[clampedDayIndex];
  if (!targetDay) return;

  const duration = event.end.getTime() - event.start.getTime();
  const newStart = new Date(targetDay);
  newStart.setHours(clampedHour, clampedMinute, 0, 0);
  const newEnd = new Date(newStart.getTime() + duration);

  emit('event-drop', { event, newStart, newEnd });
  hoveredSlot.value = null;
}
</script>

<template>
  <div class="flex flex-col" :style="{ height }">
    <!-- Day headers -->
    <div class="flex border-b border-base-300 sticky top-0 bg-base-100 z-10">
      <div class="w-16 flex-shrink-0"></div>
      <div
        v-for="day in weekDays"
        :key="day.toISOString()"
        class="flex-1 text-center text-sm font-medium py-2 border-l border-base-300"
      >
        {{ formatDate(day, 'EEE d') }}
      </div>
    </div>

    <!-- All-day events bar -->
    <div class="flex border-b border-base-300">
      <div class="w-16 flex-shrink-0 flex items-center justify-center text-xs text-base-content/50">
        Todo el día
      </div>
      <div class="flex flex-1">
        <div
          v-for="day in weekDays"
          :key="day.toISOString()"
          class="flex-1 border-l border-base-300 min-h-[2rem] p-0.5"
        >
          <CalendarEventChip
            v-for="event in getAllDayEvents(events, day)"
            :key="event.id"
            :event="event"
            class="mb-0.5"
            @click="emit('event-click', event)"
            @drag-start="onDragStart"
            @drag-end="(payload) => { onDragEnd(); handleDragEnd(event, payload); }"
          />
        </div>
      </div>
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

      <!-- Day columns -->
      <div class="flex flex-1 relative">
        <div
          v-for="day in weekDays"
          :key="day.toISOString()"
          class="flex-1 border-l border-base-300 relative"
        >
          <!-- Hour grid lines -->
          <div
            v-for="hour in hours"
            :key="hour"
            class="border-t border-base-200 relative cursor-pointer hover:bg-base-200/50"
            :class="hoveredSlot && hoveredSlot.day === day.toISOString() && hoveredSlot.startHour === hour ? 'ring-2 ring-primary ring-inset bg-primary/20' : ''"
            :style="{ height: timeSlotHeight + 'px' }"
            :ref="(el) => { if (el) slotRefs[`${day.toISOString()}||${hour}`] = el as HTMLElement }"
            @click="handleSlotClick(day, $event)"
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
            v-for="event in getDayEvents(events, day)"
            :key="event.id"
            :event="event"
            :style="getEventStyle(event, day)"
            @click="emit('event-click', event)"
            @drag-start="onDragStart"
            @drag-end="(payload) => { onDragEnd(); handleDragEnd(event, payload); }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
