<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import type { ChatMessage as ChatMessageData, ChatToolCall } from '../composables/useChatStream';
import ChatToolCallBadge from './ChatToolCallBadge.vue';

const props = defineProps<{
  message: ChatMessageData;
  isStreaming?: boolean;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(str: string, lang: string): string {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    try {
      return `<pre class="hljs"><code class="language-${language}">${hljs.highlight(str, { language }).value}</code></pre>`;
    } catch {
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
  },
});

const renderedHtml = computed(() => {
  const raw = md.render(props.message.content || '');
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
  });
});

const isUser = computed(() => props.message.role === 'user');

const toolCalls = computed<ChatToolCall[]>(() => props.message.toolCalls ?? []);
</script>

<template>
  <div
    class="ka-msg flex flex-col gap-2 py-3 px-2"
    :class="isUser ? 'items-end' : 'items-start'"
  >
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
      class="ka-msg-bubble max-w-[85%] rounded-2xl px-4 py-3 shadow-sm"
      :class="isUser
        ? 'bg-primary text-primary-content rounded-br-sm'
        : 'bg-base-200 text-base-content rounded-bl-sm'"
    >
      <div
        v-if="isUser"
        class="whitespace-pre-wrap break-words"
      >{{ message.content }}</div>
      <div
        v-else
        class="prose prose-sm max-w-none break-words ka-chat-markdown"
        v-html="renderedHtml"
      />

      <div v-if="isStreaming && !isUser" class="flex items-center gap-1.5 mt-2">
        <span class="ka-stream-cursor inline-block w-1.5 h-4 bg-current opacity-80 rounded-sm animate-pulse" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ka-chat-markdown :deep(pre.hljs) {
  /* Neutral code background that follows the active DaisyUI theme. */
  background: hsl(var(--b3, var(--b2, 217 19% 27%)) / 1);
  color: hsl(var(--bc));
  border: 1px solid hsl(var(--bc) / 0.12);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.5rem 0;
  position: relative;
}
.ka-chat-markdown :deep(code:not(.hljs code)) {
  background: hsl(var(--bc) / 0.08);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
.ka-chat-markdown :deep(.hljs) {
  background: transparent;
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
