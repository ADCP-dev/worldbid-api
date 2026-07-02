<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { format } from 'date-fns';
import Calendar from '@/modules/base/ui-app/components/calendar/Calendar.vue';
import FormInput from '@/modules/base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@/modules/base/ui-app/components/form/FormTextArea.vue';
import type { CalendarEvent } from '@/modules/base/ui-app/components/calendar/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getScheduled,
  updateScheduled,
  cancelScheduled,
  getLocalPosts,
  uploadVideo,
  uploadPhotos,
  uploadText,
} = useUploadPost();

// ─── Calendar state ─────────────────────────────────────────────────────

const events = ref<CalendarEvent[]>([]);
const loading = ref(false);
const isCreateModalOpen = ref(false);
const isDetailModalOpen = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);

const createForm = ref({
  mediaType: 'video' as 'video' | 'photo' | 'text',
  title: '',
  caption: '',
  platforms: [] as string[],
  videoUrl: '',
  photoUrls: '',
  text: '',
  startDate: '',
  startTime: '',
});

const createStart = ref<Date | null>(null);
const createEnd = ref<Date | null>(null);

const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube', 'linkedin',
  'facebook', 'x', 'threads', 'pinterest', 'reddit', 'bluesky',
];

// ─── Load scheduled posts into calendar events ──────────────────────────

async function loadEvents() {
  loading.value = true;
  try {
    const [scheduled, local] = await Promise.all([
      getScheduled(),
      getLocalPosts(),
    ]);

    const calEvents: CalendarEvent[] = [];

    // Scheduled posts from Upload-Post API
    if (scheduled?.posts) {
      for (const post of scheduled.posts) {
        const date = new Date(post.scheduled_date);
        const platforms = post.platforms?.join(', ') ?? '';
        calEvents.push({
          id: post.job_id,
          title: post.title || 'Programado',
          description: `${platforms}${post.caption ? ' — ' + post.caption : ''}`,
          start: date,
          end: new Date(date.getTime() + 60 * 60 * 1000),
          color: 'bg-primary',
          tags: (post.platforms ?? []).map((p: string) => ({
            id: p,
            label: p,
            color: 'badge-primary',
          })),
          metadata: { type: 'scheduled', jobId: post.job_id },
        });
      }
    }

    // Local posts (pending/processing/success)
    if (Array.isArray(local)) {
      for (const post of local) {
        if (post.status === 'success' || post.status === 'processing' || post.status === 'pending') {
          const date = post.publishedAt || post.scheduledAt || post.createdAt;
          const colors: Record<string, string> = {
            success: 'bg-success',
            processing: 'bg-warning',
            pending: 'bg-info',
          };
          calEvents.push({
            id: post.id,
            title: post.title || post.mediaType,
            description: `${post.platforms?.join(', ') ?? ''}${post.caption ? ' — ' + post.caption : ''}`,
            start: new Date(date),
            end: new Date(new Date(date).getTime() + 60 * 60 * 1000),
            color: colors[post.status] ?? 'bg-neutral',
            tags: (post.platforms ?? []).map((p: string) => ({
              id: p,
              label: p,
              color: 'badge-outline',
            })),
            metadata: { type: 'local', requestId: post.requestId, status: post.status },
          });
        }
      }
    }

    events.value = calEvents;
  } catch (err: any) {
    toast.error('Error cargando publicaciones', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadEvents);

// ─── Event handlers ─────────────────────────────────────────────────────

function handleEventClick(event: CalendarEvent) {
  selectedEvent.value = event;
  isDetailModalOpen.value = true;
}

function handleEventCreate(payload: { start: Date; end: Date; allDay: boolean }) {
  createStart.value = payload.start;
  createEnd.value = payload.end;
  createForm.value = {
    mediaType: 'video',
    title: '',
    caption: '',
    platforms: [],
    videoUrl: '',
    photoUrls: '',
    text: '',
    startDate: format(payload.start, 'yyyy-MM-dd'),
    startTime: format(payload.start, 'HH:mm'),
  };
  isCreateModalOpen.value = true;
}

async function handleEventDrop({ event, newStart }: { event: CalendarEvent; newStart: Date }) {
  const meta = event.metadata as any;
  if (meta?.type === 'scheduled' && meta?.jobId) {
    try {
      await updateScheduled(meta.jobId, {
        scheduledDate: newStart.toISOString(),
      });
      toast.success('Publicación reprogramada', {
        description: format(newStart, 'dd/MM/yyyy HH:mm'),
      });
      await loadEvents();
    } catch (err: any) {
      toast.error('Error al reprogramar', { description: err.message });
    }
  }
}

async function handleCreateSubmit() {
  if (!createForm.value.title.trim()) {
    toast.error('El título es obligatorio');
    return;
  }
  if (createForm.value.platforms.length === 0) {
    toast.error('Selecciona al menos una plataforma');
    return;
  }

  const [hour, minute] = createForm.value.startTime.split(':').map(Number);
  const scheduledDate = new Date(createForm.value.startDate);
  scheduledDate.setHours(hour || 0, minute || 0, 0, 0);

  try {
    if (createForm.value.mediaType === 'video') {
      await uploadVideo({
        title: createForm.value.title,
        platforms: createForm.value.platforms,
        videoUrl: createForm.value.videoUrl || undefined,
        caption: createForm.value.caption || undefined,
        scheduledDate: scheduledDate.toISOString(),
      });
    } else if (createForm.value.mediaType === 'photo') {
      await uploadPhotos({
        title: createForm.value.title,
        platforms: createForm.value.platforms,
        photoUrls: createForm.value.photoUrls
          ? createForm.value.photoUrls.split('\n').filter(Boolean)
          : undefined,
        caption: createForm.value.caption || undefined,
        scheduledDate: scheduledDate.toISOString(),
      });
    } else {
      await uploadText({
        user: 'som-os',
        platforms: createForm.value.platforms,
        text: createForm.value.text,
        title: createForm.value.title,
        scheduledDate: scheduledDate.toISOString(),
      });
    }

    toast.success('Publicación programada', {
      description: format(scheduledDate, 'dd/MM/yyyy HH:mm'),
    });
    isCreateModalOpen.value = false;
    await loadEvents();
  } catch (err: any) {
    toast.error('Error al programar', { description: err.message });
  }
}

async function handleCancelScheduled() {
  const meta = selectedEvent.value?.metadata as any;
  if (meta?.jobId) {
    try {
      await cancelScheduled(meta.jobId);
      toast.success('Publicación cancelada');
      isDetailModalOpen.value = false;
      await loadEvents();
    } catch (err: any) {
      toast.error('Error al cancelar', { description: err.message });
    }
  }
}

function togglePlatform(platform: string) {
  const idx = createForm.value.platforms.indexOf(platform);
  if (idx > -1) {
    createForm.value.platforms.splice(idx, 1);
  } else {
    createForm.value.platforms.push(platform);
  }
}

function formatEventDateRange(event: CalendarEvent): string {
  return `${format(event.start, 'dd/MM/yyyy HH:mm')} - ${format(event.end, 'HH:mm')}`;
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Social Media — Calendario</h1>
      <button class="btn btn-primary btn-sm" @click="loadEvents">
        <span v-if="loading" class="loading loading-spinner loading-xs" />
        Actualizar
      </button>
    </div>

    <div class="flex-1 p-4 overflow-hidden">
      <Calendar
        :events="events"
        view="month"
        :loading="loading"
        @event-click="handleEventClick"
        @event-create="handleEventCreate"
        @event-drop="handleEventDrop"
      />
    </div>
  </div>

  <!-- Create / Schedule Modal -->
  <dialog class="modal" :class="{ 'modal-open': isCreateModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Programar Publicación</h3>

      <div class="space-y-3">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Tipo de contenido</span>
          </label>
          <div class="join">
            <button
              v-for="type in ['video', 'photo', 'text']"
              :key="type"
              class="btn btn-sm join-item"
              :class="{ 'btn-primary': createForm.mediaType === type }"
              @click="createForm.mediaType = type as any"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <FormInput
          v-model="createForm.title"
          label="Título"
          placeholder="Título de la publicación"
          required
        />

        <FormTextArea
          v-model="createForm.caption"
          label="Caption / Descripción"
          placeholder="Texto de la publicación"
          :rows="3"
        />

        <!-- Media URL depending on type -->
        <FormInput
          v-if="createForm.mediaType === 'video'"
          v-model="createForm.videoUrl"
          label="URL del video"
          placeholder="https://..."
        />
        <FormTextArea
          v-else-if="createForm.mediaType === 'photo'"
          v-model="createForm.photoUrls"
          label="URLs de fotos (una por línea)"
          placeholder="https://...\nhttps://..."
          :rows="3"
        />
        <FormTextArea
          v-else
          v-model="createForm.text"
          label="Texto"
          placeholder="Contenido del post"
          :rows="4"
        />

        <!-- Platforms -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Plataformas</span>
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in ALL_PLATFORMS"
              :key="p"
              class="badge cursor-pointer"
              :class="{ 'badge-primary': createForm.platforms.includes(p) }"
              @click="togglePlatform(p)"
            >
              {{ p }}
            </button>
          </div>
        </div>

        <!-- Schedule -->
        <div class="grid grid-cols-2 gap-3">
          <FormInput
            v-model="createForm.startDate"
            label="Fecha"
            type="text"
            placeholder="yyyy-MM-dd"
          />
          <FormInput
            v-model="createForm.startTime"
            label="Hora"
            type="text"
            placeholder="HH:mm"
          />
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="isCreateModalOpen = false">Cancelar</button>
        <button class="btn btn-primary" @click="handleCreateSubmit">Programar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="isCreateModalOpen = false">
      <button>close</button>
    </form>
  </dialog>

  <!-- Event Detail Modal -->
  <dialog class="modal" :class="{ 'modal-open': isDetailModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-2">{{ selectedEvent?.title }}</h3>

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
        <span class="text-sm font-medium">Plataformas:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          <span
            v-for="tag in selectedEvent.tags"
            :key="tag.id"
            class="badge badge-outline"
          >
            {{ tag.label }}
          </span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="isDetailModalOpen = false">Cerrar</button>
        <button
          v-if="(selectedEvent?.metadata as any)?.type === 'scheduled'"
          class="btn btn-error btn-outline"
          @click="handleCancelScheduled"
        >
          Cancelar publicación
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="isDetailModalOpen = false">
      <button>close</button>
    </form>
  </dialog>
</template>