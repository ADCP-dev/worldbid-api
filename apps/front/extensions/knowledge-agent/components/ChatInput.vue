<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { toast } from 'vue-sonner';
import {
  SendHorizonal,
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

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
  canImage?: boolean;
  canPdf?: boolean;
  canAudio?: boolean;
}>();

const emit = defineEmits<{
  send: [content: string, attachments: PendingAttachment[]];
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
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

async function submit(): Promise<void> {
  const content = text.value.trim();
  if (props.disabled || reading.value) return;
  if (!content && files.value.length === 0) return;

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
  <div class="border-t border-base-300 bg-base-100 p-3">
    <div class="max-w-4xl mx-auto">
      <!-- Selected attachment chips -->
      <div v-if="files.length > 0" class="flex flex-wrap gap-2 mb-2">
        <div
          v-for="(f, i) in files"
          :key="`${f.file.name}-${i}`"
          class="flex items-center gap-1.5 rounded-xl border border-base-300 bg-base-200/60 p-1 pr-1"
        >
          <img
            v-if="f.previewUrl"
            :src="f.previewUrl"
            :alt="f.file.name"
            class="w-10 h-10 rounded-lg object-cover"
          >
          <span
            v-else
            class="w-10 h-10 rounded-lg bg-base-300/60 flex items-center justify-center text-base-content/70"
          >
            <FileAudio v-if="isAudioFile(f)" :size="18" />
            <ImageIcon v-else-if="isImageFile(f)" :size="18" />
            <FileText v-else :size="18" />
          </span>
          <span class="flex flex-col min-w-0 max-w-[160px]">
            <span class="text-xs truncate">{{ f.file.name }}</span>
            <span class="text-[10px] text-base-content/50">{{ formatSize(f.file.size) }}</span>
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle"
            :aria-label="t('ext.ka.chat.removeAttachment')"
            @click="removeFile(i)"
          >
            <X :size="13" />
          </button>
        </div>
      </div>

      <div class="flex items-end gap-2">
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
          class="btn btn-ghost btn-square"
          :disabled="disabled"
          :aria-label="t('ext.ka.chat.attach')"
          @click="fileInputRef?.click()"
        >
          <Paperclip :size="18" />
        </button>
        <textarea
          ref="textareaRef"
          v-model="text"
          :placeholder="placeholder ?? t('ext.ka.chat.inputPlaceholder', 'Escribe al agente…')"
          :disabled="disabled"
          rows="1"
          class="textarea textarea-bordered flex-1 resize-none leading-normal"
          style="max-height: 200px;"
          @input="autoResize"
          @keydown="onKeydown"
        />
        <button
          class="btn btn-primary btn-square"
          :disabled="disabled || reading || (!text.trim() && files.length === 0)"
          :aria-label="t('ext.ka.chat.send', 'Send message')"
          @click="submit"
        >
          <span v-if="disabled || reading" class="loading loading-spinner loading-sm"/>
          <SendHorizonal v-else :size="18" />
        </button>
      </div>
      <p class="text-xs text-base-content/40 text-center mt-1.5 flex items-center justify-center gap-1.5">
        <kbd class="kbd kbd-xs">Enter</kbd>
        {{ t('ext.ka.chat.hintSend', 'to send') }}
        <span class="opacity-40">·</span>
        <kbd class="kbd kbd-xs">Shift</kbd><span class="opacity-60">+</span><kbd class="kbd kbd-xs">Enter</kbd>
        {{ t('ext.ka.chat.hintNewline', 'for a newline') }}
      </p>
    </div>
  </div>
</template>
