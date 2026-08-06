<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { format } from 'date-fns';
import { Upload, RefreshCw } from 'lucide-vue-next';
import FormInput from '@/modules/base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@/modules/base/ui-app/components/form/FormTextArea.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  uploadVideo,
  uploadPhotos,
  uploadText,
  getUploadStatus,
  getUploadHistory,
} = useUploadPost();

type MediaType = 'video' | 'photo' | 'text';

const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'youtube', 'linkedin',
  'facebook', 'x', 'threads', 'pinterest', 'reddit', 'bluesky',
];

const form = ref({
  mediaType: 'video' as MediaType,
  title: '',
  caption: '',
  platforms: [] as string[],
  videoUrl: '',
  photoUrls: '',
  text: '',
  user: 'som-os',
  scheduledDate: '',
});

const submitting = ref(false);
const history = ref<unknown[]>([]);
const historyLoading = ref(false);
const statusResult = ref<Record<string, unknown> | null>(null);
const statusLoading = ref(false);
const statusQuery = ref({ requestId: '', jobId: '' });

const platformOptions = computed(() =>
  ALL_PLATFORMS.map((p) => ({ label: p, value: p })),
);

function togglePlatform(platform: string) {
  const idx = form.value.platforms.indexOf(platform);
  if (idx > -1) {
    form.value.platforms.splice(idx, 1);
  } else {
    form.value.platforms.push(platform);
  }
}


async function handleSubmit() {
  if (!form.value.title.trim()) {
    toast.error('El título es obligatorio');
    return;
  }
  if (form.value.platforms.length === 0) {
    toast.error('Selecciona al menos una plataforma');
    return;
  }

  if (form.value.mediaType === 'text' && !form.value.text.trim()) {
    toast.error('El texto es obligatorio');
    return;
  }

  submitting.value = true;
  try {
    const scheduledDate = form.value.scheduledDate
      ? new Date(form.value.scheduledDate).toISOString()
      : undefined;

    if (form.value.mediaType === 'video') {
      await uploadVideo({
        title: form.value.title,
        platforms: form.value.platforms,
        videoUrl: form.value.videoUrl || undefined,
        caption: form.value.caption || undefined,
        scheduledDate,
      });
    } else if (form.value.mediaType === 'photo') {
      await uploadPhotos({
        title: form.value.title,
        platforms: form.value.platforms,
        photoUrls: form.value.photoUrls
          ? form.value.photoUrls.split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
        caption: form.value.caption || undefined,
        scheduledDate,
      });
    } else {
      await uploadText({
        user: form.value.user,
        platforms: form.value.platforms,
        text: form.value.text,
        title: form.value.title,
        scheduledDate,
      });
    }

    toast.success('Upload encolado', {
      description: scheduledDate ? `Programado: ${format(new Date(scheduledDate), 'dd/MM/yyyy HH:mm')}` : 'Inmediato',
    });
    form.value = {
      mediaType: form.value.mediaType,
      title: '',
      caption: '',
      platforms: [],
      videoUrl: '',
      photoUrls: '',
      text: '',
      user: 'som-os',
      scheduledDate: '',
    };
    await loadHistory();
  } catch (err: unknown) {
    toast.error('Error en upload', { description: errorMessage(err) });
  } finally {
    submitting.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const res = await getUploadHistory();
    history.value = Array.isArray(res) ? res : (res as Record<string, unknown>)?.items as unknown[] ?? [];
  } catch (err: unknown) {
    toast.error('Error cargando historial', { description: errorMessage(err) });
  } finally {
    historyLoading.value = false;
  }
}

async function checkStatus() {
  if (!statusQuery.value.requestId && !statusQuery.value.jobId) {
    toast.error('Indica requestId o jobId');
    return;
  }
  statusLoading.value = true;
  try {
    statusResult.value = await getUploadStatus(
      statusQuery.value.requestId || undefined,
      statusQuery.value.jobId || undefined,
    ) as Record<string, unknown>;
  } catch (err: unknown) {
    toast.error('Error consultando estado', { description: errorMessage(err) });
  } finally {
    statusLoading.value = false;
  }
}

function statusBadgeClass(status: unknown): string {
  const s = String(status ?? '').toLowerCase();
  if (s === 'success' || s === 'completed') return 'badge-success';
  if (s === 'processing' || s === 'pending') return 'badge-warning';
  if (s === 'failed' || s === 'error') return 'badge-error';
  return 'badge-ghost';
}

onMounted(loadHistory);
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <Upload class="w-6 h-6" />
        Subir publicación
      </h1>
    </div>

    <!-- Form -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6 space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Tipo de contenido</span>
          </label>
          <div class="join">
            <button
              v-for="type in (['video', 'photo', 'text'] as MediaType[])"
              :key="type"
              class="btn btn-sm join-item capitalize"
              :class="{ 'btn-primary': form.mediaType === type }"
              @click="form.mediaType = type"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <FormInput
          v-model="form.title"
          label="Título"
          placeholder="Título de la publicación"
          required
        />

        <FormTextArea
          v-model="form.caption"
          label="Caption / Descripción"
          placeholder="Texto de la publicación"
          :rows="3"
        />

        <FormInput
          v-if="form.mediaType === 'video'"
          v-model="form.videoUrl"
          label="URL del video"
          placeholder="https://..."
        />

        <FormTextArea
          v-else-if="form.mediaType === 'photo'"
          v-model="form.photoUrls"
          label="URLs de fotos (una por línea)"
          placeholder="https://...&#10;https://..."
          :rows="3"
        />

        <template v-else>
          <FormTextArea
            v-model="form.text"
            label="Texto"
            placeholder="Contenido del post"
            :rows="4"
          />
          <FormInput
            v-model="form.user"
            label="Usuario / perfil"
            placeholder="som-os"
          />
        </template>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Plataformas</span>
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in platformOptions"
              :key="opt.value"
              class="badge cursor-pointer capitalize"
              :class="{ 'badge-primary': form.platforms.includes(opt.value) }"
              @click="togglePlatform(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <FormInput
          v-model="form.scheduledDate"
          label="Fecha programada (opcional)"
          type="text"
          placeholder="yyyy-MM-ddTHH:mm"
          description="ISO 8601. Vacío = publicar ahora."
        />

        <div class="flex justify-end">
          <button
            class="btn btn-primary"
            :disabled="submitting"
            @click="handleSubmit"
          >
            <span v-if="submitting" class="loading loading-spinner loading-xs" />
            {{ form.scheduledDate ? 'Programar' : 'Publicar ahora' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Status check -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6 space-y-3">
        <h2 class="text-lg font-semibold">Consultar estado</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormInput
            v-model="statusQuery.requestId"
            label="Request ID"
            placeholder="req_..."
          />
          <FormInput
            v-model="statusQuery.jobId"
            label="Job ID"
            placeholder="job_..."
          />
        </div>
        <div class="flex justify-end">
          <button
            class="btn btn-sm btn-outline"
            :disabled="statusLoading"
            @click="checkStatus"
          >
            <span v-if="statusLoading" class="loading loading-spinner loading-xs" />
            Consultar
          </button>
        </div>
        <div v-if="statusResult" class="mockup-code text-xs">
          <pre>{{ JSON.stringify(statusResult, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">Historial de uploads</h2>
          <button class="btn btn-ghost btn-sm" @click="loadHistory">
            <RefreshCw class="w-4 h-4" />
            Actualizar
          </button>
        </div>

        <div v-if="historyLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="history.length === 0" class="text-center py-8 text-base-content/50">
          Sin historial todavía
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Título</th>
                <th>Plataformas</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in history" :key="i">
                <td class="text-sm">{{ (item as Record<string, unknown>).title ?? '—' }}</td>
                <td class="text-sm">
                  {{ Array.isArray((item as Record<string, unknown>).platforms) ? ((item as Record<string, unknown>).platforms as string[]).join(', ') : '—' }}
                </td>
                <td>
                  <span class="badge badge-sm" :class="statusBadgeClass((item as Record<string, unknown>).status)">
                    {{ String((item as Record<string, unknown>).status ?? '—') }}
                  </span>
                </td>
                <td class="text-xs">
                  {{ (item as Record<string, unknown>).createdAt ? new Date((item as Record<string, unknown>).createdAt as string).toLocaleString() : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>