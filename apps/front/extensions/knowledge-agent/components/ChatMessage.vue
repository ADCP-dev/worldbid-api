<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import { toast } from 'vue-sonner';
import { FileAudio, FileText, Image as ImageIcon } from 'lucide-vue-next';
import type { ChatMessage as ChatMessageData, ChatToolCall } from '../composables/useChatStream';
import ChatToolCallBadge from './ChatToolCallBadge.vue';

const props = defineProps<{
  message: ChatMessageData;
  isStreaming?: boolean;
}>();

const { t } = useI18n();

/** UTF-8-safe browser base64 (TextEncoder instead of deprecated escape/unescape). */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const copyLabel = t('ext.ka.chat.copyCode');

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight(str: string, lang: string): string {
    // Mermaid blocks are NOT highlighted: rendered as diagrams post-mount.
    if (lang === 'mermaid') {
      return `<pre class="ka-mermaid-src"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    // Raw code is carried base64-encoded on the button so the copy handler
    // never needs to reconstruct it from (already highlighted) DOM text.
    const dataCode = toBase64(str);
    const header =
      `<div class="ka-code-header"><span class="ka-code-lang">${language.toUpperCase()}` +
      `</span><button type="button" class="ka-code-copy" data-code-copy data-code="${dataCode}">${copyLabel}</button></div>`;
    try {
      return (
        `<div class="ka-code-block">${header}` +
        `<pre class="hljs"><code class="language-${language}">${hljs.highlight(str, { language }).value}</code></pre></div>`
      );
    } catch {
      return (
        `<div class="ka-code-block">${header}` +
        `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre></div>`
      );
    }
  },
});

const renderedHtml = computed(() => {
  const raw = md.render(props.message.content || '');
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'span', 'div', 'button',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'type', 'data-code', 'data-code-copy'],
  });
});

const isUser = computed(() => props.message.role === 'user');

const toolCalls = computed<ChatToolCall[]>(() => props.message.toolCalls ?? []);

const attachments = computed(() => props.message.attachments ?? []);

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isAudioMime(mime: string): boolean {
  return mime.startsWith('audio/');
}

/** Copy handler delegated from the markdown container (code block buttons). */
function onMarkdownClick(e: MouseEvent): void {
  const target = e.target instanceof HTMLElement ? e.target : null;
  const btn = target?.closest<HTMLElement>('[data-code-copy]');
  if (!btn) return;
  const b64 = btn.getAttribute('data-code');
  if (!b64) return;
  let code = '';
  try {
    code = fromBase64(b64);
  } catch {
    return;
  }
  void navigator.clipboard.writeText(code).then(() => {
    toast.success(t('ext.ka.chat.copied'));
    const previous = btn.textContent;
    btn.textContent = t('ext.ka.chat.copied');
    setTimeout(() => {
      btn.textContent = previous;
    }, 1600);
  });
}

/* ── Mermaid rendering ──────────────────────────────────────────────────
 * markdown-it emits <pre class="ka-mermaid-src"><code>…</code></pre> for
 * mermaid blocks (no highlight). After the sanitized HTML lands in the DOM
 * we swap each source block for the rendered SVG. Import is lazy + single.
 * Partial diagrams during streaming fail to parse → kept as source until
 * the block closes and parses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mermaidModule: any = null;

async function renderMermaidBlocks(): Promise<void> {
  const root = markdownRoot.value;
  if (!root) return;
  const sources = root.querySelectorAll('pre.ka-mermaid-src:not([data-rendered])');
  if (sources.length === 0) return;

  if (!mermaidModule) {
    try {
      mermaidModule = await import('mermaid');
      mermaidModule.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
      });
    } catch {
      return; // mermaid unavailable → blocks stay as readable source
    }
  }
  const mermaid = mermaidModule.default;
  let idCounter = 0;
  for (const pre of Array.from(sources)) {
    pre.setAttribute('data-rendered', '1');
    const code = pre.querySelector('code')?.textContent ?? '';
    const id = `ka-mermaid-${Math.random().toString(36).slice(2)}-${idCounter++}`;
    try {
      const { svg } = await mermaid.render(id, code);
      const wrapper = document.createElement('div');
      wrapper.className = 'ka-mermaid-svg';
      wrapper.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: ['style'],
      });
      pre.replaceWith(wrapper);
    } catch {
      // Incomplete/invalid diagram during streaming: leave the source
      // visible but marked so we don't retry the same node forever.
      pre.setAttribute('data-render-error', '1');
    }
  }
}

const markdownRoot = ref<HTMLElement | null>(null);

watch(
  () => renderedHtml.value,
  async () => {
    if (isUser.value) return;
    await nextTick();
    void renderMermaidBlocks();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  // mermaid holds render timers; module-level cleanup is not required.
});
</script>

<template>
  <div
    class="ka-msg flex flex-col gap-1.5 py-2 px-2"
    :class="isUser ? 'items-end' : 'items-start'"
  >
    <!-- User attachment chips -->
    <div
      v-if="isUser && attachments.length > 0"
      class="flex flex-wrap justify-end gap-1.5 max-w-[80%]"
    >
      <span
        v-for="(att, idx) in attachments"
        :key="`${message.id}-att-${idx}`"
        class="inline-flex items-center gap-1 rounded-lg bg-base-200/80 border border-base-300/70 px-2 py-1 text-xs text-base-content/80"
      >
        <FileAudio v-if="isAudioMime(att.mimeType)" :size="12" class="shrink-0 opacity-70" />
        <ImageIcon v-else-if="isImageMime(att.mimeType)" :size="12" class="shrink-0 opacity-70" />
        <FileText v-else :size="12" class="shrink-0 opacity-70" />
        <span class="max-w-[140px] truncate">{{ att.name }}</span>
      </span>
    </div>

    <!-- Tool calls (assistant only) -->
    <div
      v-if="!isUser && toolCalls.length > 0"
      class="ka-msg-tools flex flex-wrap gap-1.5 max-w-[85%]"
    >
      <ChatToolCallBadge
        v-for="(call, idx) in toolCalls"
        :key="call.id ?? `${message.id}-tc-${idx}`"
        :call="call"
      />
    </div>

    <!-- Bubble -->
    <div
      class="ka-msg-bubble px-4 py-3 shadow-sm"
      :class="isUser
        ? 'max-w-[80%] bg-primary text-primary-content rounded-2xl rounded-br-md'
        : 'max-w-[85%] bg-base-200/70 border border-base-300/50 text-base-content rounded-2xl rounded-bl-md'"
    >
      <div
        v-if="isUser"
        class="whitespace-pre-wrap break-words"
      >{{ message.content }}</div>
      <div
        v-else
        ref="markdownRoot"
        class="prose prose-sm sm:prose-base max-w-none break-words prose-invert ka-chat-markdown"
        @click="onMarkdownClick"
        v-html="renderedHtml"
      />

      <div v-if="isStreaming && !isUser" class="flex items-center gap-1.5 mt-2">
        <span class="ka-stream-cursor inline-block w-1.5 h-4 bg-current opacity-80 rounded-sm" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Mermaid diagrams ─────────────────────────────────────────────────── */
.ka-chat-markdown :deep(.ka-mermaid-svg) {
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 0.625rem;
  padding: 0.75rem;
  margin: 0.625rem 0;
  overflow-x: auto;
  display: flex;
  justify-content: center;
}
.ka-chat-markdown :deep(.ka-mermaid-svg svg) {
  max-width: 100%;
  height: auto;
}
.ka-chat-markdown :deep(pre.ka-mermaid-src) {
  background: var(--color-base-200);
  border: 1px dashed var(--color-base-300);
  border-radius: 0.625rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.625rem 0;
}
.ka-chat-markdown :deep(pre.ka-mermaid-src[data-render-error='1'])::after {
  content: '⏳ diagram incomplete — waiting for the full mermaid block';
  display: block;
  margin-top: 0.5rem;
  font-size: 11px;
  opacity: 0.55;
}

/* ── Code blocks (header bar + hljs dark theme) ─────────────────────────── */
.ka-chat-markdown :deep(.ka-code-block) {
  background: var(--color-base-200);
  border: 1px solid var(--color-base-300);
  border-radius: 0.625rem;
  overflow: hidden;
  margin: 0.625rem 0;
}
.ka-chat-markdown :deep(.ka-code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0.35rem 0.3rem 0.75rem;
  background: var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
}
.ka-chat-markdown :deep(.ka-code-lang) {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.ka-chat-markdown :deep(.ka-code-copy) {
  font-size: 10px;
  line-height: 1.4;
  padding: 1px 8px;
  border-radius: 0.375rem;
  cursor: pointer;
  color: var(--color-base-content);
  background: transparent;
  border: 1px solid transparent;
  opacity: 0.65;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}
.ka-chat-markdown :deep(.ka-code-copy:hover) {
  opacity: 1;
  border-color: var(--color-base-content);
}
.ka-chat-markdown :deep(.ka-code-block pre.hljs) {
  background: transparent;
  margin: 0;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  border-radius: 0;
  border: 0;
  font-size: 0.8125rem;
  line-height: 1.55;
}
.ka-chat-markdown :deep(.ka-code-block pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}
/* Inline code (outside code blocks) */
.ka-chat-markdown :deep(code:not(pre code)) {
  background: color-mix(in oklab, var(--color-base-content) 8%, transparent);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

/* Material Palenight-ish token palette for the luxury-dark theme */
.ka-chat-markdown :deep(.hljs-keyword),
.ka-chat-markdown :deep(.hljs-selector-tag),
.ka-chat-markdown :deep(.hljs-literal-keyword) {
  color: #c792ea;
}
.ka-chat-markdown :deep(.hljs-string),
.ka-chat-markdown :deep(.hljs-regexp),
.ka-chat-markdown :deep(.hljs-addition) {
  color: #c3e88d;
}
.ka-chat-markdown :deep(.hljs-number),
.ka-chat-markdown :deep(.hljs-literal) {
  color: #f78c6c;
}
.ka-chat-markdown :deep(.hljs-comment),
.ka-chat-markdown :deep(.hljs-quote) {
  color: #546e7a;
  font-style: italic;
}
.ka-chat-markdown :deep(.hljs-function .hljs-title),
.ka-chat-markdown :deep(.hljs-title),
.ka-chat-markdown :deep(.hljs-title.function_),
.ka-chat-markdown :deep(.hljs-section) {
  color: #82aaff;
}
.ka-chat-markdown :deep(.hljs-title.class_) {
  color: #ffcb6b;
}
.ka-chat-markdown :deep(.hljs-variable),
.ka-chat-markdown :deep(.hljs-template-variable),
.ka-chat-markdown :deep(.hljs-tag),
.ka-chat-markdown :deep(.hljs-name),
.ka-chat-markdown :deep(.hljs-deletion) {
  color: #f07178;
}
.ka-chat-markdown :deep(.hljs-attr),
.ka-chat-markdown :deep(.hljs-attribute),
.ka-chat-markdown :deep(.hljs-selector-attr),
.ka-chat-markdown :deep(.hljs-selector-class),
.ka-chat-markdown :deep(.hljs-selector-id) {
  color: #ffcb6b;
}
.ka-chat-markdown :deep(.hljs-built_in),
.ka-chat-markdown :deep(.hljs-symbol),
.ka-chat-markdown :deep(.hljs-bullet),
.ka-chat-markdown :deep(.hljs-meta) {
  color: #89ddff;
}
.ka-chat-markdown :deep(.hljs-params) {
  color: #f78c6c;
}
.ka-chat-markdown :deep(.hljs-type),
.ka-chat-markdown :deep(.hljs-class .hljs-title) {
  color: #ffcb6b;
}
.ka-chat-markdown :deep(.hljs-emphasis) {
  font-style: italic;
}
.ka-chat-markdown :deep(.hljs-strong) {
  font-weight: 700;
}

/* Blinking streaming cursor */
@keyframes ka-cursor-blink {
  0%, 49% { opacity: 0.9; }
  50%, 100% { opacity: 0.15; }
}
.ka-stream-cursor {
  animation: ka-cursor-blink 1s steps(2, start) infinite;
}
</style>
