<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { CalendarEvent, CalendarView } from './types';
import { useCalendar } from './composables/useCalendar';
import CalendarToolbar from './CalendarToolbar.vue';
import CalendarMonthView from './CalendarMonthView.vue';
import CalendarWeekView from './CalendarWeekView.vue';
import CalendarDayView from './CalendarDayView.vue';

const props = withDefaults(defineProps<{
  events: CalendarEvent[];
  view?: CalendarView;
  initialDate?: Date;
  firstDayOfWeek?: number;
  loading?: boolean;
  height?: string;
  snapMinutes?: number;
}>(), {
  view: 'month',
  initialDate: () => new Date(),
  firstDayOfWeek: 1,
  loading: false,
  height: '75vh',
  snapMinutes: 15,
});

const emit = defineEmits<{
  (e: 'event-click', event: CalendarEvent): void;
  (e: 'event-create', payload: { start: Date; end: Date; allDay: boolean }): void;
  (e: 'event-drop', payload: { event: CalendarEvent; newStart: Date; newEnd: Date }): void;
  (e: 'update:view', view: CalendarView): void;
  (e: 'update:current-date', date: Date): void;
}>();

const currentView = ref<CalendarView>(props.view);
const currentDate = ref<Date>(new Date(props.initialDate));

const { getTitle, navigateDate } = useCalendar();

const title = computed(() => getTitle(currentDate.value, currentView.value));

watch(() => props.view, (newView) => {
  currentView.value = newView;
});

watch(() => props.initialDate, (newDate) => {
  if (newDate) {
    currentDate.value = new Date(newDate);
  }
});

watch(currentView, (newView) => {
  emit('update:view', newView);
});

watch(currentDate, (newDate) => {
  emit('update:current-date', newDate);
});

function handlePrev() {
  currentDate.value = navigateDate(currentDate.value, 'prev', currentView.value);
}

function handleNext() {
  currentDate.value = navigateDate(currentDate.value, 'next', currentView.value);
}

function handleToday() {
  currentDate.value = navigateDate(currentDate.value, 'today', currentView.value);
}

function handleChangeView(view: CalendarView) {
  currentView.value = view;
}

function handleEventClick(event: CalendarEvent) {
  emit('event-click', event);
}

function handleEventCreate(payload: { start: Date; end: Date; allDay: boolean }) {
  emit('event-create', payload);
}

function handleEventDrop(payload: { event: CalendarEvent; newStart: Date; newEnd: Date }) {
  emit('event-drop', payload);
}
</script>

<template>
  <div class="flex flex-col h-full bg-base-100 rounded-box border border-base-300 overflow-hidden">
    <CalendarToolbar
      :current-date="currentDate"
      :view="currentView"
      :title="title"
      @prev="handlePrev"
      @next="handleNext"
      @today="handleToday"
      @change-view="handleChangeView"
    />

    <div :style="{ height }" class="overflow-auto relative">
      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-base-100/80 z-10"
      >
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>

      <CalendarMonthView
        v-if="currentView === 'month'"
        :events="events"
        :current-date="currentDate"
        :first-day-of-week="firstDayOfWeek"
        :height="height"
        @event-click="handleEventClick"
        @event-create="handleEventCreate"
        @event-drop="handleEventDrop"
        @navigate-to-day="(date: Date) => { currentDate = date; currentView = 'week'; }"
      />
      <CalendarWeekView
        v-else-if="currentView === 'week'"
        :events="events"
        :current-date="currentDate"
        :first-day-of-week="firstDayOfWeek"
        :height="height"
        :snap-minutes="snapMinutes"
        @event-click="handleEventClick"
        @event-create="handleEventCreate"
        @event-drop="handleEventDrop"
      />
      <CalendarDayView
        v-else-if="currentView === 'day'"
        :events="events"
        :current-date="currentDate"
        :height="height"
        :snap-minutes="snapMinutes"
        @event-click="handleEventClick"
        @event-create="handleEventCreate"
        @event-drop="handleEventDrop"
      />
    </div>
  </div>
</template>
