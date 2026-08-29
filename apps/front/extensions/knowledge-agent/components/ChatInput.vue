<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Paperclip,
  X,
  FileText,
  FileAudio,
  Image as ImageIcon,
} from 'lucide-vue-next';

/** Attachment payload sent to the backend (base64 WITHOUT the data: prefix). */
interface PendingAttachment {
  name: string;
  mimeType: string;
  data: string;
}

export interface AgentChipOption {
  label: string;
  value: string;
}

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
  canImage?: boolean;
  canPdf?: boolean;
  canAudio?: boolean;
  agentId?: string | null;
  agents?: AgentChipOption[];
  modelId?: string | null;
}>();

const emit = defineEmits<{
  send: [content: string, attachments: PendingAttachment[]];
  'update:agentId': [value: string];
}>();

const { t } = useI18n();

const MAX_FILES = 6;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface SelectedFile {
  file: File;
  previewUrl?: string;
}

const text = ref('');
const files = ref<SelectedFile[]>([]);
const reading = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

/** Accept string derived from model capabilities; txt/json are always allowed. */
const accept = computed(() => {
  const parts: string[] = ['text/*', 'application/json'];
  if (props.canPdf) parts.push('application/pdf');
  if (props.canImage) parts.push('image/*');
  if (props.canAudio) parts.push('audio/*');
  return parts.join(',');
});

function isAllowedMime(mime: string): boolean {
  if (mime.startsWith('text/') || mime === 'application/json') return true;
  if (mime === 'application/pdf') return props.canPdf === true;
  if (mime.startsWith('image/')) return props.canImage === true;
  if (mime.startsWith('audio/')) return props.canAudio === true;
  return false;
}

function isImageFile(f: SelectedFile): boolean {
  return f.file.type.startsWith('image/');
}

function isAudioFile(f: SelectedFile): boolean {
  return f.file.type.startsWith('audio/');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-effort mime guess when the browser reports an empty file.type. */
function guessMime(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'md') return 'text/markdown';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'json') return 'application/json';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function onPickFiles(e: Event): void {
  const input = e.target as HTMLInputElement | null;
  const picked = Array.from(input?.files ?? []);
  if (input) input.value = '';

  for (const file of picked) {
    if (files.value.length >= MAX_FILES) {
      toast.warning(t('ext.ka.chat.tooManyFiles', { max: MAX_FILES }));
      break;
    }
    const mime = file.type || guessMime(file);
    if (!isAllowedMime(mime)) {
      toast.warning(t('ext.ka.chat.attachWarning'));
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.warning(
        t('ext.ka.chat.fileTooBig', { name: file.name, size: formatSize(MAX_FILE_BYTES) }),
      );
      continue;
    }
    const entry: SelectedFile = { file };
    if (mime.startsWith('image/')) {
      void readFileAsDataUrl(file).then((url) => {
        entry.previewUrl = url;
      });
    }
    files.value.push(entry);
  }
}

function removeFile(index: number): void {
  files.value.splice(index, 1);
}

function autoResize(): void {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
}

const canSubmit = computed(
  () => !props.disabled && !reading.value && (text.value.trim().length > 0 || files.value.length > 0),
);

const currentAgentLabel = computed(() => {
  const found = props.agents?.find((a) => a.value === props.agentId);
  if (found) {
    // Show the short agent name (before the " (provider:model)" suffix).
    return found.label.split(' (')[0] ?? found.label;
  }
  return props.agents?.[0]?.label.split(' (')[0] ?? t('ext.ka.chat.agentFallback', 'Agente');
});

/** Pick an agent from the dropdown; close it by blurring the button. */
function onPickAgent(value: string): void {
  emit('update:agentId', value);
  const el = document.activeElement as HTMLElement | null;
  el?.blur();
}

async function submit(): Promise<void> {
  const content = text.value.trim();
  if (!canSubmit.value) return;

  let attachments: PendingAttachment[] = [];
  if (files.value.length > 0) {
    reading.value = true;
    try {
      attachments = await Promise.all(
        files.value.map(async (f) => {
          const dataUrl = await readFileAsDataUrl(f.file);
          return {
            name: f.file.name,
            mimeType: f.file.type || guessMime(f.file),
            data: dataUrl.slice(dataUrl.indexOf(',') + 1),
          };
        }),
      );
    } finally {
      reading.value = false;
    }
  }

  emit('send', content, attachments);
  text.value = '';
  files.value = [];
  nextTick(autoResize);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void submit();
  }
}
</script>

<template>
  <!-- OpenCode-style floating composer pill -->
  <div class="px-3 pb-3 pt-1 bg-gradient-to-t from-base-100 via-base-100 to-transparent">
    <div class="max-w-4xl mx-auto">
      <!-- Attachment chips: inside the pill, above the text row -->
      <div v-if="files.length > 0" class="flex flex-wrap gap-2 px-3 pt-3">
        <div
          v-for="(f, i) in files"
          :key="`${f.file.name}-${i}`"
          class="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200/70 pl-1 pr-0.5 py-0.5"
        >
          <img
            v-if="f.previewUrl"
            :src="f.previewUrl"
            :alt="f.file.name"
            class="w-8 h-8 rounded-md object-cover"
          >
          <span
            v-else
            class="w-8 h-8 rounded-md bg-base-300/70 flex items-center justify-center text-base-content/70"
          >
            <FileAudio v-if="isAudioFile(f)" :size="15" />
            <ImageIcon v-else-if="isImageFile(f)" :size="15" />
            <FileText v-else :size="15" />
          </span>
          <span class="flex flex-col min-w-0 max-w-[150px] leading-tight">
            <span class="text-[11px] truncate font-medium">{{ f.file.name }}</span>
            <span class="text-[9px] text-base-content/50">{{ formatSize(f.file.size) }}</span>
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle h-5 w-5 min-h-5"
            :aria-label="t('ext.ka.chat.removeAttachment')"
            @click="removeFile(i)"
          >
            <X :size="11" />
          </button>
        </div>
      </div>

      <div
        class="ka-composer rounded-3xl border border-base-300 bg-base-200/80 shadow-lg focus-within:border-primary/60 transition-colors"
      >
        <div class="flex items-end gap-1 px-2 py-1.5">
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="accept"
            class="hidden"
            @change="onPickFiles"
          >
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle shrink-0 text-base-content/70 hover:text-primary"
            :disabled="disabled"
            :aria-label="t('ext.ka.chat.attach')"
            :title="t('ext.ka.chat.attach')"
            @click="fileInputRef?.click()"
          >
            <Paperclip :size="18" />
          </button>

          <!-- Agent selector chip (OpenCode-style, inside the pill) -->
          <div v-if="agents && agents.length > 0" class="dropdown dropdown-top shrink-0">
            <button
              type="button"
              tabindex="0"
              class="btn btn-ghost btn-sm gap-1 rounded-full text-base-content/70 hover:text-primary normal-case px-2"
              :disabled="disabled"
            >
              <Bot :size="15" />
              <span class="max-w-[130px] truncate text-xs font-medium">
                {{ currentAgentLabel }}
              </span>
              <ChevronDown :size="12" class="opacity-60" />
            </button>
            <ul
              tabindex="0"
              class="dropdown-content z-50 menu menu-sm rounded-xl bg-base-100 border border-base-300 shadow-xl w-64 mb-1"
            >
              <li
                v-for="opt in agents"
                :key="opt.value"
              >
                <button
                  type="button"
                  :class="{ active: opt.value === agentId }"
                  @click="onPickAgent(opt.value)"
                >
                  <Bot :size="14" class="opacity-60" />
                  <span class="truncate">{{ opt.label }}</span>
                </button>
              </li>
            </ul>
          </div>

          <textarea
            ref="textareaRef"
            v-model="text"
            :placeholder="placeholder ?? t('ext.ka.chat.inputPlaceholder', 'Escribe al agente…')"
            :disabled="disabled"
            rows="1"
            class="ka-composer-input flex-1 bg-transparent border-none outline-none resize-none leading-relaxed py-2 min-h-[38px] text-sm placeholder:text-base-content/40 focus:outline-none"
            style="max-height: 180px;"
            @input="autoResize"
            @keydown="onKeydown"
          />

          <button
            type="button"
            class="ka-send btn btn-circle btn-sm shrink-0 border-none text-primary-content shadow-md transition-all"
            :class="canSubmit ? 'bg-primary hover:bg-primary/90' : 'bg-base-300 text-base-content/40 cursor-not-allowed'"
            :disabled="disabled || reading || !canSubmit"
            :aria-label="t('ext.ka.chat.send', 'Send message')"
            @click="submit"
          >
            <span v-if="disabled || reading" class="loading loading-spinner loading-xs" />
            <ArrowUp v-else :size="18" :stroke-width="2.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ka-composer :deep(textarea) {
  field-sizing: content;
}
/* Slim scrollbar-free composer input */
.ka-composer-input::-webkit-scrollbar {
  display: none;
}
.ka-composer-input {
  scrollbar-width: none;
}
</style>