<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { format } from 'date-fns';
import { ListOrdered, Save, RefreshCw } from 'lucide-vue-next';
import FormInput from '@/modules/base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@/modules/base/ui-app/components/form/FormSwitch.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  getQueuePreview,
  getQueueNextSlot,
  getQueueSettings,
  updateQueueSettings,
} = useUploadPost();

const preview = ref<unknown[]>([]);
const nextSlot = ref<unknown | null>(null);
const loading = ref(false);

const settingsForm = ref({
  publishDays: '',
  publishTime: '',
  maxPerWeek: 0,
  skipWeekends: true,
  timezone: 'America/Montevideo',
});

const settingsLoading = ref(false);
const saving = ref(false);


async function loadAll() {
  loading.value = true;
  settingsLoading.value = true;
  try {
    const [previewRes, slotRes, settingsRes] = await Promise.all([
      getQueuePreview(),
      getQueueNextSlot(),
      getQueueSettings(),
    ]);

    preview.value = Array.isArray(previewRes) ? previewRes : ((previewRes as Record<string, unknown>)?.items as unknown[]) ?? [];
    nextSlot.value = slotRes;
    const s = settingsRes as Record<string, unknown>;
    if (s && typeof s === 'object') {
      settingsForm.value = {
        publishDays: typeof s.publishDays === 'string' ? s.publishDays : '',
        publishTime: typeof s.publishTime === 'string' ? s.publishTime : '',
        maxPerWeek: typeof s.maxPerWeek === 'number' ? s.maxPerWeek : 0,
        skipWeekends: typeof s.skipWeekends === 'boolean' ? s.skipWeekends : true,
        timezone: typeof s.timezone === 'string' ? s.timezone : 'America/Montevideo',
      };
    }
  } catch (err: unknown) {
    toast.error('Error cargando cola', { description: errorMessage(err) });
  } finally {
    loading.value = false;
    settingsLoading.value = false;
  }
}

async function handleSaveSettings() {
  saving.value = true;
  try {
    await updateQueueSettings({
      publishDays: settingsForm.value.publishDays || undefined,
      publishTime: settingsForm.value.publishTime || undefined,
      maxPerWeek: settingsForm.value.maxPerWeek || undefined,
      skipWeekends: settingsForm.value.skipWeekends,
      timezone: settingsForm.value.timezone || undefined,
    });
    toast.success('Configuración de cola guardada');
  } catch (err: unknown) {
    toast.error('Error guardando configuración', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

function formatSlot(slot: unknown): string {
  if (!slot) return '—';
  const dateStr = (slot as Record<string, unknown>)?.nextSlot ?? (slot as Record<string, unknown>)?.date ?? (slot as Record<string, unknown>)?.scheduledDate;
  if (typeof dateStr === 'string') {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
    } catch {
      return String(dateStr);
    }
  }
  return JSON.stringify(slot);
}

function previewRowDate(row: unknown): string {
  const r = row as Record<string, unknown>;
  const d = r.scheduledDate ?? r.scheduledAt ?? r.date ?? r.createdAt;
  if (typeof d === 'string') {
    try {
      return format(new Date(d), 'dd/MM/yyyy HH:mm');
    } catch {
      return d;
    }
  }
  return '—';
}

onMounted(loadAll);
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <ListOrdered class="w-6 h-6" />
        Cola de publicaciones
      </h1>
      <button class="btn btn-ghost btn-sm" @click="loadAll">
        <RefreshCw class="w-4 h-4" />
        Actualizar
      </button>
    </div>

    <!-- Next slot -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <h2 class="text-lg font-semibold">Próximo slot disponible</h2>
        <div v-if="loading" class="flex justify-center py-4">
          <span class="loading loading-spinner loading-md" />
        </div>
        <div v-else class="flex items-center gap-4">
          <div class="text-3xl font-bold text-primary">
            {{ formatSlot(nextSlot) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Preview -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <h2 class="text-lg font-semibold mb-3">Vista previa de la cola</h2>

        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="preview.length === 0" class="text-center py-8 text-base-content/50">
          Cola vacía
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Título</th>
                <th>Plataformas</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in preview" :key="i">
                <td class="text-sm">{{ (row as Record<string, unknown>).title ?? '—' }}</td>
                <td class="text-sm">
                  {{ Array.isArray((row as Record<string, unknown>).platforms) ? ((row as Record<string, unknown>).platforms as string[]).join(', ') : '—' }}
                </td>
                <td class="text-xs">{{ previewRowDate(row) }}</td>
                <td>
                  <span class="badge badge-sm badge-ghost">
                    {{ String((row as Record<string, unknown>).status ?? '—') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6 space-y-4">
        <h2 class="text-lg font-semibold">Configuración de cola</h2>

        <div v-if="settingsLoading" class="flex justify-center py-4">
          <span class="loading loading-spinner loading-sm" />
        </div>

        <template v-else>
          <FormInput
            v-model="settingsForm.publishDays"
            label="Días de publicación"
            placeholder="mon,wed,fri"
            description="Días separados por coma (mon,tue,wed,thu,fri,sat,sun)."
          />

          <FormInput
            v-model="settingsForm.publishTime"
            label="Hora de publicación"
            placeholder="HH:mm"
            description="Formato 24h. Ej: 18:30"
          />

          <FormInput
            v-model="settingsForm.maxPerWeek"
            label="Máximo por semana"
            type="number"
            placeholder="7"
          />

          <FormInput
            v-model="settingsForm.timezone"
            label="Zona horaria"
            placeholder="America/Montevideo"
          />

          <FormSwitch
            v-model="settingsForm.skipWeekends"
            label="Saltar fines de semana"
          />

          <div class="flex justify-end pt-2">
            <button
              class="btn btn-primary"
              :disabled="saving"
              @click="handleSaveSettings"
            >
              <Save class="w-4 h-4" />
              <span v-if="saving" class="loading loading-spinner loading-xs" />
              Guardar
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>