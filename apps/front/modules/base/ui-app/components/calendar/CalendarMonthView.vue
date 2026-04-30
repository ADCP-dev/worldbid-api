<script setup lang="ts">
import { computed, ref } from 'vue';
import { format, isSameDay } from 'date-fns';
import type { CalendarEvent as CalendarEventType, MonthDayCell } from './types';
import { useCalendar } from './composables/useCalendar';
import CalendarEvent from './CalendarEvent.vue';

const props = withDefaults(defineProps<{
  events: CalendarEventType[];
  currentDate: Date;
  firstDayOfWeek?: number;
  height?: string;
}>(), {
  firstDayOfWeek: 1,
});

const emit = defineEmits<{
  (e: 'event-click', event: CalendarEventType): void;
  (e: 'event-create', payload: { start: Date; end: Date; allDay: boolean }): void;
  (e: 'event-drop', payload: { event: CalendarEventType; newStart: Date; newEnd: Date }): void;
  (e: 'navigate-to-day', date: Date): void;
}>();

const { generateMonthGrid, weekDays } = useCalendar();

const grid = computed<MonthDayCell[]>(() => {
  const cells = generateMonthGrid(props.currentDate, props.firstDayOfWeek);
  return cells.map(cell => ({
    ...cell,
    events: props.events.filter(event => isSameDay(event.start, cell.date)),
  }));
});

const cellRefs = ref<Record<string, HTMLElement>>({});
const isDragActive = ref(false);
const hoveredCellDate = ref<string | null>(null);

function handleCellClick(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  emit('event-create', { start: date, end, allDay: true });
}

function handleEventClick(event: CalendarEventType) {
  emit('event-click', event);
}

function onDragStart() {
  isDragActive.value = true;
  document.addEventListener('pointermove', onDragPointerMove);
}

function onDragPointerMove(e: PointerEvent) {
  for (const [dateStr, cellEl] of Object.entries(cellRefs.value)) {
    const rect = cellEl.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      hoveredCellDate.value = dateStr;
      return;
    }
  }
  hoveredCellDate.value = null;
}

function onDragEnd() {
  isDragActive.value = false;
  hoveredCellDate.value = null;
  document.removeEventListener('pointermove', onDragPointerMove);
}

function handleDragEnd(event: CalendarEventType, payload: { clientX: number; clientY: number }) {
  for (const [dateStr, cellEl] of Object.entries(cellRefs.value)) {
    const rect = cellEl.getBoundingClientRect();
    if (
      payload.clientX >= rect.left &&
      payload.clientX <= rect.right &&
      payload.clientY >= rect.top &&
      payload.clientY <= rect.bottom
    ) {
      const targetDate = new Date(dateStr);
      const duration = event.end.getTime() - event.start.getTime();

      const newStart = new Date(targetDate);
      newStart.setHours(
        event.start.getHours(),
        event.start.getMinutes(),
        event.start.getSeconds(),
        event.start.getMilliseconds(),
      );

      const newEnd = new Date(newStart.getTime() + duration);
      emit('event-drop', { event, newStart, newEnd });
      return;
    }
  }
}
</script>

<template>
  <div class="flex flex-col" :style="{ height }">
    <!-- Week day headers -->
    <div class="grid grid-cols-7 border-b border-base-300">
      <div
        v-for="day in weekDays"
        :key="day"
        class="text-center text-sm font-medium py-2 text-base-content/70"
      >
        {{ day }}
      </div>
    </div>

    <!-- Month grid -->
    <div class="grid grid-cols-7 flex-1">
      <div
        v-for="cell in grid"
        :key="cell.date.toISOString()"
        class="calendar-cell min-h-[100px] relative flex flex-col"
        :class="{
          'calendar-cell-other-month': !cell.isCurrentMonth,
          'calendar-cell-today': cell.isToday,
          'ring-2 ring-primary ring-inset bg-primary/20': hoveredCellDate === cell.date.toISOString(),
        }"
        :ref="(el) => { if (el) cellRefs[cell.date.toISOString()] = el as HTMLElement }"
        @click="handleCellClick(cell.date)"
      >
        <span
          class="text-sm font-medium self-end mb-1"
          :class="{
            'text-primary font-bold': cell.isToday,
            'text-base-content/50': !cell.isCurrentMonth,
          }"
        >
          {{ format(cell.date, 'd') }}
        </span>

        <div class="flex-1 flex flex-col gap-0.5 overflow-visible">
          <CalendarEvent
            v-for="eventItem in cell.events.slice(0, 3)"
            :key="eventItem.id"
            :event="eventItem"
            @click="handleEventClick"
            @drag-start="onDragStart"
            @drag-end="(payload) => { onDragEnd(); handleDragEnd(eventItem, payload); }"
          />

          <button
            v-if="cell.events.length > 3"
            class="text-xs text-center text-base-content/60 hover:text-primary transition-colors py-0.5"
            @click.stop="emit('navigate-to-day', cell.date)"
          >
            +{{ cell.events.length - 3 }} más
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
