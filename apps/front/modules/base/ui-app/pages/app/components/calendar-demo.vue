<script setup lang="ts">
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { format } from 'date-fns';
import Calendar from '@/modules/base/ui-app/components/calendar/Calendar.vue';
import FormInput from '@/modules/base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@/modules/base/ui-app/components/form/FormTextArea.vue';
import type { CalendarEvent } from '@/modules/base/ui-app/components/calendar/types';

definePageMeta({
  layout: 'default',
});

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

function makeDate(day: number, hour: number = 0, minute: number = 0): Date {
  return new Date(year, month, day, hour, minute);
}

const events = ref<CalendarEvent[]>([
  {
    id: 'evt-1',
    title: 'Reunión de planificación',
    description: 'Planificar sprint Q2',
    start: makeDate(today.getDate(), 10),
    end: makeDate(today.getDate(), 11),
    color: 'bg-primary',
    tags: [
      { id: 'tag-1', label: 'Reunión', color: 'badge-primary' },
    ],
    assignees: [
      { id: 'user-1', name: 'Ana García', email: 'ana@example.com', role: 'PM' },
    ],
    location: 'Sala A',
  },
  {
    id: 'evt-2',
    title: 'Demo del producto',
    description: 'Presentar avances al cliente',
    start: makeDate(today.getDate(), 14),
    end: makeDate(today.getDate(), 15, 30),
    color: 'bg-secondary',
    tags: [
      { id: 'tag-2', label: 'Demo', color: 'badge-secondary' },
    ],
    assignees: [
      { id: 'user-2', name: 'Carlos López', email: 'carlos@example.com', role: 'Dev' },
    ],
  },
  {
    id: 'evt-3',
    title: 'Revisión de código',
    start: makeDate(today.getDate(), 9),
    end: makeDate(today.getDate(), 10),
    color: 'bg-accent',
    assignees: [
      { id: 'user-3', name: 'María Ruiz', email: 'maria@example.com', role: 'Tech Lead' },
    ],
  },
  {
    id: 'evt-4',
    title: 'Deploy a producción',
    start: makeDate(today.getDate(), 18),
    end: makeDate(today.getDate(), 19),
    color: 'bg-success',
    tags: [
      { id: 'tag-3', label: 'DevOps', color: 'badge-success' },
    ],
  },
  {
    id: 'evt-5',
    title: 'Evento recurrente',
    start: makeDate(today.getDate(), 12),
    end: makeDate(today.getDate(), 13),
    color: 'bg-info',
    isRecurring: true,
  },
  {
    id: 'evt-6',
    title: 'All-day planning',
    start: makeDate(today.getDate(), 0),
    end: makeDate(today.getDate(), 23, 59),
    color: 'bg-warning',
    allDay: true,
  },
  {
    id: 'evt-7',
    title: 'Design workshop',
    start: makeDate(today.getDate(), 11, 30),
    end: makeDate(today.getDate(), 13),
    color: 'bg-error',
  },
  {
    id: 'evt-8',
    title: 'Standup matutino',
    start: makeDate(today.getDate(), 9),
    end: makeDate(today.getDate(), 9, 30),
    color: 'bg-neutral',
  },
]);

const isCreateModalOpen = ref(false);
const isDetailModalOpen = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);

const createForm = ref({
  title: '',
  description: '',
  allDay: false,
  startDate: '',
  startTime: '',
  endTime: '',
});

const createStart = ref<Date | null>(null);
const createEnd = ref<Date | null>(null);

function openCreateModal(start: Date, end: Date, allDay: boolean) {
  createStart.value = start;
  createEnd.value = end;
  createForm.value = {
    title: '',
    description: '',
    allDay,
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: allDay ? '' : format(start, 'HH:mm'),
    endTime: allDay ? '' : format(end, 'HH:mm'),
  };
  isCreateModalOpen.value = true;
}

function closeCreateModal() {
  isCreateModalOpen.value = false;
}

function openDetailModal(event: CalendarEvent) {
  selectedEvent.value = event;
  isDetailModalOpen.value = true;
}

function closeDetailModal() {
  isDetailModalOpen.value = false;
  selectedEvent.value = null;
}

function handleEventClick(event: CalendarEvent) {
  openDetailModal(event);
}

function handleEventCreate(payload: { start: Date; end: Date; allDay: boolean }) {
  openCreateModal(payload.start, payload.end, payload.allDay);
}

function handleCreateEventSubmit() {
  if (!createForm.value.title.trim()) {
    toast.error('El título es obligatorio');
    return;
  }

  let start: Date;
  let end: Date;

  if (createForm.value.allDay) {
    start = new Date(createStart.value!);
    start.setHours(0, 0, 0, 0);
    end = new Date(createEnd.value!);
    end.setHours(23, 59, 59, 999);
  } else {
    const [startHour, startMinute] = createForm.value.startTime.split(':').map(Number);
    const [endHour, endMinute] = createForm.value.endTime.split(':').map(Number);
    start = new Date(createForm.value.startDate);
    start.setHours(startHour || 0, startMinute || 0, 0, 0);
    end = new Date(createForm.value.startDate);
    end.setHours(endHour || 0, endMinute || 0, 0, 0);
  }

  const newEvent: CalendarEvent = {
    id: `evt-${Date.now()}`,
    title: createForm.value.title.trim(),
    description: createForm.value.description || undefined,
    start,
    end,
    allDay: createForm.value.allDay,
    color: 'bg-warning',
  };

  events.value.push(newEvent);
  closeCreateModal();
  toast.success('Evento creado', { description: newEvent.title });
}

function handleEventDrop({ event, newStart, newEnd }: { event: CalendarEvent; newStart: Date; newEnd: Date }) {
  const idx = events.value.findIndex(e => e.id === event.id);
  if (idx > -1) {
    events.value[idx] = { ...events.value[idx], start: newStart, end: newEnd };
    // Trigger reactivity
    events.value = [...events.value];
  }
  toast.success('Evento movido');
}

function formatEventDateRange(event: CalendarEvent): string {
  if (event.allDay) {
    return format(event.start, 'dd/MM/yyyy') + ' (Todo el día)';
  }
  return `${format(event.start, 'dd/MM/yyyy HH:mm')} - ${format(event.end, 'HH:mm')}`;
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Calendario</h1>
    </div>

    <div class="flex-1 p-4 overflow-hidden">
      <Calendar
        :events="events"
        view="month"
        @event-click="handleEventClick"
        @event-create="handleEventCreate"
        @event-drop="handleEventDrop"
      />
    </div>
  </div>

  <!-- Create Event Modal -->
  <dialog class="modal" :class="{ 'modal-open': isCreateModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Nuevo Evento</h3>

      <div class="space-y-3">
        <FormInput
          v-model="createForm.title"
          label="Título"
          placeholder="Título del evento"
          required
        />

        <FormTextArea
          v-model="createForm.description"
          label="Descripción"
          placeholder="Descripción del evento"
          :rows="3"
        />

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              v-model="createForm.allDay"
              type="checkbox"
              class="checkbox checkbox-primary"
            >
            <span class="label-text">Todo el día</span>
          </label>
        </div>

        <FormInput
          v-if="!createForm.allDay"
          v-model="createForm.startDate"
          label="Fecha inicio"
          type="text"
          placeholder="yyyy-MM-dd"
        />

        <div v-if="!createForm.allDay" class="grid grid-cols-2 gap-3">
          <FormInput
            v-model="createForm.startTime"
            label="Hora inicio"
            type="text"
            placeholder="HH:mm"
          />
          <FormInput
            v-model="createForm.endTime"
            label="Hora fin"
            type="text"
            placeholder="HH:mm"
          />
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="closeCreateModal">Cancelar</button>
        <button class="btn btn-primary" @click="handleCreateEventSubmit">Crear</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="closeCreateModal">
      <button>close</button>
    </form>
  </dialog>

  <!-- Event Detail Modal -->
  <dialog class="modal" :class="{ 'modal-open': isDetailModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-2">
        {{ selectedEvent?.title }}
      </h3>

      <p
        v-if="selectedEvent?.description"
        class="text-sm text-base-content/70 mb-3"
      >
        {{ selectedEvent.description }}
      </p>

      <div class="text-sm mb-3">
        <span class="font-medium">Fecha:</span>
        {{ selectedEvent ? formatEventDateRange(selectedEvent) : '' }}
      </div>

      <div v-if="selectedEvent?.tags?.length" class="mb-3">
        <span class="text-sm font-medium">Etiquetas:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span
            v-for="tag in selectedEvent.tags"
            :key="tag.id"
            class="badge"
            :class="tag.color || 'badge-outline'"
          >
            {{ tag.label }}
          </span>
        </div>
      </div>

      <div v-if="selectedEvent?.assignees?.length" class="mb-3">
        <span class="text-sm font-medium">Asignados:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span
            v-for="assignee in selectedEvent.assignees"
            :key="assignee.id"
            class="badge badge-outline"
          >
            {{ assignee.name }}
          </span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="closeDetailModal">Cerrar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="closeDetailModal">
      <button>close</button>
    </form>
  </dialog>
</template>
