<script setup lang="ts">
import { computed, ref } from 'vue';
import { Download, Printer, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

/**
 * KaFileViewer — modal viewer for agent-generated sandbox artifacts.
 *
 * Rendering strategy per type:
 *   - text/html → iframe (srcdoc-free, direct URL) + "Save as PDF" button
 *     that calls iframe.contentWindow.print() (the browser's print dialog
 *     offers Save as PDF — zero heavy deps vs puppeteer).
 *   - application/pdf | images → direct embed/img.
 *   - text/* | json | code → read via fetch (with auth) into a <pre> because
 *     <object>/<embed> of text/* downloads instead of rendering on some
 *     browsers. Auth is required for the API, so content is fetched as blob
 *     and objectURL'd for iframe/img too (token-in-URL is avoided).
 */
const props = defineProps<{
  file: { name: string; path: string; size: number; mtime: string; mime: string };
  sessionId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const loading = ref(true);
const loadError = ref<string | null>(null);
/** text-like files: raw content for <pre> */
const textContent = ref<string | null>(null);
/** blob-based object URL for iframe/img/embed */
const objectUrl = ref<string | null>(null);

const isHtml = computed(() => props.file.mime === 'text/html');
const isPdf = computed(() => props.file.mime === 'application/pdf');
const isImage = computed(() => props.file.mime.startsWith('image/'));
const isTextLike = computed(
  () =>
    props.file.mime.startsWith('text/') ||
    props.file.mime === 'application/json' ||
    props.file.mime === 'application/xml',
);

const authHeaders = computed<Record<string, string>>(() => {
  const token = useAuthStore().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
});

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  textContent.value = null;
  objectUrl.value = null;
  try {
    const cfg = useRuntimeConfig();
    const url = `${cfg.public.apiUrl}${cfg.public.apiPrefix ?? '/api/v1'}/ka/chat/sessions/${props.sessionId}/files/content?path=${encodeURIComponent(props.file.path)}`;
    const resp = await fetch(url, { headers: authHeaders.value });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    if (isTextLike.value) {
      textContent.value = await resp.text();
    } else {
      const blob = await resp.blob();
      objectUrl.value = URL.createObjectURL(blob);
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const printFrame = ref<HTMLIFrameElement | null>(null);

/** Print the HTML iframe → browser dialog offers "Save as PDF". */
function printHtml(): void {
  const frame = printFrame.value;
  try {
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  } catch {
    toast.error(t('ext.ka.chat.printUnavailable', 'Impresión no disponible'));
  }
}

function download(): void {
  const cfg = useRuntimeConfig();
  const url = `${cfg.public.apiUrl}${cfg.public.apiPrefix ?? '/api/v1'}/ka/chat/sessions/${props.sessionId}/files/content?path=${encodeURIComponent(props.file.path)}&download=1`;
  window.open(url, '_blank');
}

void load();

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <dialog class="modal modal-open" @keydown.escape="emit('close')">
    <div class="modal-box w-11/12 max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-base-300 bg-base-200/70 shrink-0">
        <FileText :size="16" class="text-primary shrink-0" />
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-sm truncate">{{ file.name }}</h3>
          <p class="text-[11px] text-base-content/50 leading-none">
            {{ file.path }} · {{ formatSize(file.size) }}
          </p>
        </div>
        <button
          v-if="isHtml"
          type="button"
          class="btn btn-xs btn-primary gap-1"
          @click="printHtml"
        >
          <Printer :size="13" />
          {{ t('ext.ka.chat.saveAsPdf', 'Guardar como PDF') }}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost gap-1"
          :aria-label="t('ext.ka.chat.downloadFile', 'Descargar')"
          :title="t('ext.ka.chat.downloadFile', 'Descargar')"
          @click="download"
        >
          <Download :size="14" />
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle"
          :aria-label="t('ext.ka.chat.close')"
          @click="emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 min-h-0 bg-base-100">
        <div v-if="loading" class="flex justify-center items-center h-full">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div v-else-if="loadError" class="flex flex-col items-center justify-center h-full gap-2 text-error">
          <span>{{ loadError }}</span>
        </div>

        <!-- HTML: iframe + print-to-PDF -->
        <iframe
          v-else-if="isHtml && objectUrl"
          ref="printFrame"
          :src="objectUrl"
          class="w-full h-full border-0 bg-white"
          sandbox="allow-same-origin allow-modals"
        />

        <!-- PDF -->
        <embed
          v-else-if="isPdf && objectUrl"
          :src="objectUrl"
          type="application/pdf"
          class="w-full h-full"
        >

        <!-- Images -->
        <div v-else-if="isImage && objectUrl" class="w-full h-full flex items-center justify-center p-4">
          <img :src="objectUrl" :alt="file.name" class="max-w-full max-h-full object-contain">
        </div>

        <!-- Text-like -->
        <pre
          v-else-if="textContent !== null"
          class="w-full h-full overflow-auto p-4 text-xs font-mono whitespace-pre-wrap break-words"
        >{{ textContent }}</pre>

        <!-- Binary fallback -->
        <div v-else class="flex flex-col items-center justify-center h-full gap-3 text-base-content/60">
          <FileText :size="36" class="opacity-40" />
          <p class="text-sm">{{ t('ext.ka.chat.noPreview', 'Sin vista previa para este formato') }}</p>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')" />
  </dialog>
</template>