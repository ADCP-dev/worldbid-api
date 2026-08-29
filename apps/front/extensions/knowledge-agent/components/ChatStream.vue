<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowDown,
  AudioLines,
  Bot,
  Cpu,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-vue-next';
import { useChatStream } from '../composables/useChatStream';
import { useModelCapabilities } from '@ka/composables/useModelCapabilities';
import ChatMessage from './ChatMessage.vue';
import ChatInput from './ChatInput.vue';
import KaFileViewer from './KaFileViewer.vue';

import type { AgentChipOption } from './ChatInput.vue';

interface OutgoingAttachment {
  name: string;
  mimeType: string;
  data: string;
}

const props = defineProps<{
  sessionId: string;
  agentModel?: string | null;
  agentId?: string | null;
  agentOptions?: AgentChipOption[];
}>();

const emit = defineEmits<{
  'update:agentId': [value: string];
}>();

const { t } = useI18n();

const {
  messages,
  isStreaming,
  error,
  sendMessage,
  stopStreaming,
  resetMessages,
  loadSessionHistory,
} = useChatStream();

const { canImage, canPdf, canAudio } = useModelCapabilities(
  computed(() => props.agentModel ?? null),
);

const scrollContainer = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);
const userJustSent = ref(false);
const errorDismissed = ref(false);

const visibleError = computed(() =>
  error.value && !errorDismissed.value ? error.value : null,
);

/** "openrouter:z-ai/glm-5.3-flash" → "glm-5.3-flash" for the header badge. */
const modelId = computed(() => {
  const m = props.agentModel ?? '';
  return m.includes(':') ? (m.split(':').pop() ?? m) : m;
});

const capabilityIcons = computed(() => [
  { key: 'image', icon: ImageIcon, enabled: canImage.value, tip: t('ext.ka.chat.modalities.images') },
  { key: 'pdf', icon: FileText, enabled: canPdf.value, tip: t('ext.ka.chat.modalities.pdf') },
  { key: 'audio', icon: AudioLines, enabled: canAudio.value, tip: t('ext.ka.chat.modalities.audio') },
]);

const lastMessage = computed(() => messages.value[messages.value.length - 1]);

/** "Thinking" = streaming but the placeholder assistant message is still empty. */
const showThinking = computed(
  () =>
    isStreaming.value &&
    lastMessage.value?.role === 'assistant' &&
    (lastMessage.value?.content ?? '') === '',
);

/** While thinking, the empty assistant placeholder bubble is not rendered. */
const visibleMessages = computed(() =>
  showThinking.value ? messages.value.slice(0, -1) : messages.value,
);

const suggestions = computed(() => [
  t('ext.ka.chat.suggestions.s1'),
  t('ext.ka.chat.suggestions.s2'),
  t('ext.ka.chat.suggestions.s3'),
]);

const isLastMessage = (id: string): boolean =>
  id === messages.value[messages.value.length - 1]?.id;

function onScroll(): void {
  const el = scrollContainer.value;
  if (!el) return;
  isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

function scrollToBottom(): void {
  nextTick(() => {
    const el = scrollContainer.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isNearBottom.value = true;
  });
}

// Load persisted conversation history when the chat opens AND when the route
// switches to another session (the component instance is reused).
watch(
  () => props.sessionId,
  async (id) => {
    errorDismissed.value = false;
    await loadSessionHistory(id);
    scrollToBottom();
  },
  { immediate: true },
);

// Auto-scroll while streaming: only when the user is near the bottom (or just
// sent a message) so reading history is not interrupted by new tokens.
watch(
  () => [messages.value.length, lastMessage.value?.content.length] as const,
  () => {
    if (userJustSent.value || isNearBottom.value) scrollToBottom();
  },
);

watch(isStreaming, (streaming) => {
  if (!streaming) userJustSent.value = false;
});

function onSend(content: string, attachments: OutgoingAttachment[] = []): void {
  userJustSent.value = true;
  scrollToBottom();
  void sendMessage(props.sessionId, content, attachments);
  // The agent may have just written sandbox files; refresh the list shortly
  // (stream end also refreshes — this catches write_file before text flows).
  setTimeout(() => void refreshFiles(), 1500);
}

/* ── Agent-generated files (sandbox artifacts) ───────────────────────── */
interface SandboxFile {
  name: string;
  path: string;
  size: number;
  mtime: string;
  mime: string;
}
const sessionFiles = ref<SandboxFile[]>([]);
const viewerFile = ref<SandboxFile | null>(null);

async function refreshFiles(): Promise<void> {
  try {
    const api = useApi();
    const list = await api.get<SandboxFile[]>(
      `/ka/chat/sessions/${props.sessionId}/files`,
    );
    sessionFiles.value = list ?? [];
  } catch {
    sessionFiles.value = [];
  }
}

function refreshFilesSoon(): void {
  setTimeout(() => void refreshFiles(), 400);
}

// Initial + on-session-change fetch.
watch(
  () => props.sessionId,
  async () => {
    await refreshFiles();
  },
);

// After a stream completes there may be new artifacts.
watch(isStreaming, (streaming) => {
  if (!streaming) refreshFilesSoon();
});

defineExpose({ resetMessages });
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header: model badge + capability indicators -->
    <div
      v-if="agentModel"
      class="flex items-center justify-end gap-2 px-3 py-1.5 border-b border-base-300/60 bg-base-100/50"
    >
      <div class="flex items-center gap-2">
        <span
          v-for="cap in capabilityIcons"
          :key="cap.key"
          class="tooltip tooltip-left"
          :data-tip="cap.tip"
          :title="cap.tip"
        >
          <component
            :is="cap.icon"
            :size="14"
            :class="cap.enabled ? 'text-primary' : 'text-base-content opacity-30'"
          />
        </span>
      </div>
      <span class="badge badge-sm badge-ghost gap-1 font-mono">
        <Cpu :size="12" />
        {{ modelId }}
      </span>
    </div>

    <!-- Messages -->
    <div class="relative flex-1 min-h-0">
      <div
        ref="scrollContainer"
        class="h-full overflow-y-auto px-2 py-4"
        @scroll.passive="onScroll"
      >
        <div class="max-w-4xl mx-auto min-h-full flex flex-col">
          <!-- Empty state with suggestions -->
          <div
            v-if="messages.length === 0"
            class="flex-1 flex items-center justify-center p-4"
          >
            <div class="card bg-base-200/40 border border-base-300/50 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
              <div class="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-primary-content shadow-lg">
                <Bot :size="26" />
              </div>
              <div class="space-y-1">
                <h3 class="text-lg font-semibold">{{ t('ext.ka.chat.emptyStateTitle') }}</h3>
                <p class="text-sm text-base-content/60">{{ t('ext.ka.chat.emptyStateSubtitle') }}</p>
              </div>
              <div class="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  v-for="s in suggestions"
                  :key="s"
                  type="button"
                  class="btn btn-sm btn-outline rounded-full"
                  :disabled="isStreaming"
                  @click="onSend(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>
          </div>

          <template v-else>
            <ChatMessage
              v-for="msg in visibleMessages"
              :key="msg.id"
              :message="msg"
              :is-streaming="isStreaming && msg.role === 'assistant' && isLastMessage(msg.id)"
            />
            <!-- Thinking indicator: renders AFTER the last message, exactly
                 where the assistant reply will land (same bubble shape so
                 there is no layout jump when tokens start flowing). -->
            <div
              v-if="showThinking"
              class="flex justify-start py-2 px-2"
            >
              <div class="max-w-[85%] rounded-2xl rounded-bl-md bg-base-200/70 border border-base-300/50 px-4 py-3 flex items-center gap-2.5">
                <span class="loading loading-dots loading-sm text-primary" />
                <span class="text-sm text-base-content/60">{{ t('ext.ka.chat.thinking') }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Floating scroll-to-bottom -->
      <button
        v-if="!isNearBottom"
        type="button"
        class="btn btn-circle btn-sm absolute bottom-3 right-3 shadow-lg bg-base-100 border border-base-300 hover:border-primary/50"
        :aria-label="t('ext.ka.chat.scrollBottom')"
        :title="t('ext.ka.chat.scrollBottom')"
        @click="scrollToBottom"
      >
        <ArrowDown :size="16" />
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="visibleError"
      class="mx-3 my-1.5 rounded-xl bg-error/10 border border-error/30 text-error text-sm px-3 py-2 flex items-start gap-2"
    >
      <AlertTriangle :size="15" class="shrink-0 mt-0.5" />
      <p class="flex-1 break-words">
        <span class="font-semibold">{{ t('ext.ka.chat.errorLabel') }}:</span>
        {{ visibleError }}
      </p>
      <button
        v-if="isStreaming"
        type="button"
        class="btn btn-xs btn-ghost text-error shrink-0"
        @click="stopStreaming"
      >
        {{ t('ext.ka.chat.stop') }}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-circle shrink-0"
        :aria-label="t('ext.ka.chat.close')"
        @click="errorDismissed = true"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- Input -->
    <!-- Generated files strip (only when the agent produced artifacts) -->
    <div
      v-if="sessionFiles.length > 0"
      class="mx-3 mb-1 flex flex-wrap items-center gap-2"
    >
      <span class="text-[11px] uppercase tracking-wide text-base-content/50 font-semibold shrink-0">
        {{ t('ext.ka.chat.filesLabel', 'Archivos') }}
      </span>
      <button
        v-for="f in sessionFiles.slice(0, 8)"
        :key="f.path"
        type="button"
        class="btn btn-xs gap-1.5 rounded-full border border-base-300 bg-base-200/70 hover:border-primary/50"
        :title="f.path"
        @click="viewerFile = f"
      >
        <FileText :size="12" class="text-primary" />
        <span class="max-w-[140px] truncate">{{ f.name }}</span>
        <ExternalLink :size="10" class="opacity-50" />
      </button>
    </div>

    <KaFileViewer
      v-if="viewerFile"
      :file="viewerFile"
      :session-id="sessionId"
      @close="viewerFile = null"
    />

    <ChatInput
      :disabled="isStreaming"
      :placeholder="isStreaming ? t('ext.ka.chat.streamingNow') : t('ext.ka.chat.inputPlaceholder')"
      :can-image="canImage"
      :can-pdf="canPdf"
      :can-audio="canAudio"
      :agents="agentOptions"
      :agent-id="agentId"
      :model-id="modelId"
      @send="onSend"
      @update:agent-id="emit('update:agentId', $event)"
    />
  </div>
</template>
