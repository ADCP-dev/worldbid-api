<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const {
  startAutodm,
  getAutodmStatus,
  pauseAutodm,
  resumeAutodm,
  stopAutodm,
  deleteAutodm,
  getAutodmLogs,
} = useUploadPost();

interface AutodmMonitor {
  monitor_id: string;
  post_url: string;
  status: 'running' | 'paused' | 'stopped' | 'expired';
  dms_sent?: number;
  trigger_keywords?: string[];
  expires_at?: string;
}

interface AutodmLog {
  timestamp?: string;
  username?: string;
  comment?: string;
  dm_sent?: boolean;
}

const monitors = ref<AutodmMonitor[]>([]);
const loading = ref(false);
const isCreateModalOpen = ref(false);
const logsModal = ref(false);
const currentLogs = ref<AutodmLog[]>([]);
const logsLoading = ref(false);

const createForm = ref({
  postUrl: '',
  replyMessage: '',
  monitoringInterval: 15,
  triggerKeywords: '',
});

async function loadMonitors() {
  loading.value = true;
  try {
    const result = await getAutodmStatus(true);
    monitors.value = result.monitors ?? [];
  } catch (err: unknown) {
    toast.error('Error cargando monitores', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    loading.value = false;
  }
}

onMounted(loadMonitors);

async function handleStart() {
  if (!createForm.value.postUrl || !createForm.value.replyMessage) {
    toast.error('URL del post y mensaje son obligatorios');
    return;
  }

  try {
    const keywords = createForm.value.triggerKeywords
      ? createForm.value.triggerKeywords.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    await startAutodm({
      postUrl: createForm.value.postUrl,
      replyMessage: createForm.value.replyMessage,
      monitoringInterval: createForm.value.monitoringInterval,
      triggerKeywords: keywords,
    });

    toast.success('Monitor AutoDM iniciado');
    isCreateModalOpen.value = false;
    createForm.value = { postUrl: '', replyMessage: '', monitoringInterval: 15, triggerKeywords: '' };
    await loadMonitors();
  } catch (err: unknown) {
    toast.error('Error iniciando monitor', { description: err instanceof Error ? err.message : 'Error' });
  }
}

async function handlePause(monitorId: string) {
  try { await pauseAutodm(monitorId); toast.success('Monitor pausado'); await loadMonitors(); }
  catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error'); }
}

async function handleResume(monitorId: string) {
  try { await resumeAutodm(monitorId); toast.success('Monitor reanudado'); await loadMonitors(); }
  catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error'); }
}

async function handleStop(monitorId: string) {
  try { await stopAutodm(monitorId); toast.success('Monitor detenido'); await loadMonitors(); }
  catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error'); }
}

async function handleDelete(monitorId: string) {
  try { await deleteAutodm(monitorId); toast.success('Monitor eliminado'); await loadMonitors(); }
  catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Error'); }
}

async function handleLogs(monitorId: string) {
  logsLoading.value = true;
  logsModal.value = true;
  try {
    const result = await getAutodmLogs(monitorId);
    currentLogs.value = result.logs ?? [];
  } catch (err: unknown) {
    toast.error('Error cargando logs', { description: err instanceof Error ? err.message : 'Error' });
  } finally {
    logsLoading.value = false;
  }
}

const STATUS_BADGE: Record<string, string> = {
  running: 'badge-success',
  paused: 'badge-warning',
  stopped: 'badge-error',
  expired: 'badge-ghost',
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-300">
      <h1 class="text-xl font-bold">Social Media — AutoDM</h1>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="loadMonitors">
          <span v-if="loading" class="loading loading-spinner loading-xs" />
          Actualizar
        </button>
        <button class="btn btn-primary btn-sm" @click="isCreateModalOpen = true">
          Nuevo monitor
        </button>
      </div>
    </div>

    <div class="flex-1 p-4 overflow-auto">
      <div v-if="loading && monitors.length === 0" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12 text-base-content/50">
        No hay monitores AutoDM activos
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Post URL</th>
              <th>DMs enviados</th>
              <th>Keywords</th>
              <th>Expira</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in monitors" :key="m.monitor_id">
              <td>
                <span class="badge" :class="STATUS_BADGE[m.status] ?? 'badge-ghost'">
                  {{ m.status }}
                </span>
              </td>
              <td class="max-w-xs truncate">
                <a :href="m.post_url" target="_blank" class="link link-hover text-sm">
                  {{ m.post_url }}
                </a>
              </td>
              <td>{{ m.dms_sent ?? 0 }}</td>
              <td class="text-sm">{{ m.trigger_keywords?.join(', ') ?? '—' }}</td>
              <td class="text-sm">
                {{ m.expires_at ? new Date(m.expires_at).toLocaleDateString() : '—' }}
              </td>
              <td>
                <div class="flex gap-1 justify-end">
                  <button class="btn btn-ghost btn-xs" @click="handleLogs(m.monitor_id)">Logs</button>
                  <button v-if="m.status === 'running'" class="btn btn-ghost btn-xs" @click="handlePause(m.monitor_id)">Pausar</button>
                  <button v-if="m.status === 'paused'" class="btn btn-ghost btn-xs" @click="handleResume(m.monitor_id)">Reanudar</button>
                  <button v-if="m.status !== 'stopped' && m.status !== 'expired'" class="btn btn-ghost btn-xs text-error" @click="handleStop(m.monitor_id)">Detener</button>
                  <button class="btn btn-ghost btn-xs text-error" @click="handleDelete(m.monitor_id)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create Monitor Modal -->
  <dialog class="modal" :class="{ 'modal-open': isCreateModalOpen }">
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Nuevo Monitor AutoDM</h3>

      <div class="space-y-3">
        <div class="form-control">
          <label class="label"><span class="label-text">URL del post de Instagram *</span></label>
          <input v-model="createForm.postUrl" class="input input-bordered w-full" placeholder="https://instagram.com/p/Cxxx" >
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Mensaje DM *</span></label>
          <textarea v-model="createForm.replyMessage" class="textarea textarea-bordered w-full" rows="3" placeholder="¡Gracias por comentar! Te envío el link…" />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Keywords (separadas por coma)</span></label>
          <input v-model="createForm.triggerKeywords" class="input input-bordered w-full" placeholder="info, precio, guía" >
          <label class="label-text-alt">Vacío = todos los comentarios reciben DM</label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Intervalo de monitoreo (min, min 15)</span></label>
          <input v-model.number="createForm.monitoringInterval" type="number" min="15" class="input input-bordered w-full" >
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="isCreateModalOpen = false">Cancelar</button>
        <button class="btn btn-primary" @click="handleStart">Iniciar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="isCreateModalOpen = false">
      <button>close</button>
    </form>
  </dialog>

  <!-- Logs Modal -->
  <dialog class="modal" :class="{ 'modal-open': logsModal }">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-4">Logs del Monitor</h3>

      <div v-if="logsLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md" />
      </div>

      <div v-else-if="currentLogs.length === 0" class="text-center py-8 text-base-content/50">
        Sin actividad registrada
      </div>

      <div v-else class="overflow-x-auto max-h-96">
        <table class="table table-xs">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Comentario</th>
              <th>DM</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, i) in currentLogs" :key="i">
              <td class="text-xs">{{ log.timestamp ? new Date(log.timestamp).toLocaleString() : '—' }}</td>
              <td class="text-sm">{{ log.username ?? '—' }}</td>
              <td class="text-sm max-w-xs truncate">{{ log.comment ?? '—' }}</td>
              <td>
                <span class="badge badge-xs" :class="log.dm_sent ? 'badge-success' : 'badge-ghost'">
                  {{ log.dm_sent ? 'Enviado' : '—' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-action">
        <button class="btn" @click="logsModal = false">Cerrar</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="logsModal = false">
      <button>close</button>
    </form>
  </dialog>
</template>