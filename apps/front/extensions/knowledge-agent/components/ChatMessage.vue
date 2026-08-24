<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import type { ChatMessage as ChatMessageData } from '../composables/useChatStream';

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

const codeBlocks = ref<Array<{ id: string; code: string; copied: boolean }>>([]);

watch(renderedHtml, () => {
  if (props.message.role !== 'assistant') return;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderedHtml.value;
  const blocks = tempDiv.querySelectorAll('pre code');
  codeBlocks.value = Array.from(blocks).map((el, idx) => ({
    id: `${props.message.id}-code-${idx}`,
    code: el.textContent ?? '',
    copied: false,
  }));
}, { immediate: true });

async function copyCode(block: { id: string; code: string; copied: boolean }) {
  try {
    await navigator.clipboard.writeText(block.code);
    block.copied = true;
    setTimeout(() => { block.copied = false; }, 2000);
  } catch {
    // clipboard not available
  }
}

const isUser = computed(() => props.message.role === 'user');
</script>

<template>
  <div
    class="flex gap-3 py-4 px-2"
    :class="isUser ? 'flex-row-reverse' : 'flex-row'"
  >
    <!-- Avatar -->
    <div class="avatar avatar-placeholder shrink-0">
      <div
        class="w-8 rounded-full"
        :class="isUser ? 'bg-primary text-primary-content' : 'bg-neutral text-neutral-content'"
      >
        <span class="text-xs font-bold">
          {{ isUser ? 'U' : 'A' }}
        </span>
      </div>
    </div>

    <!-- Bubble -->
    <div
      class="max-w-[80%] rounded-lg px-4 py-3"
      :class="isUser
        ? 'bg-primary text-primary-content'
        : 'bg-base-200 text-base-content'"
    >
      <div
        v-if="isUser"
        class="whitespace-pre-wrap break-words"
      >{{ message.content }}</div>
      <div
        v-else
        class="prose prose-sm max-w-none break-words chat-markdown"
        v-html="renderedHtml"
      />

      <div v-if="isStreaming && !isUser" class="flex items-center gap-1 mt-2">
        <span class="loading loading-dots loading-xs opacity-60"/>
      </div>

      <div v-if="!isUser && codeBlocks.length > 0" class="mt-2 space-y-1">
        <div
          v-for="block in codeBlocks"
          :key="block.id"
          class="flex justify-end"
        >
          <button
            class="btn btn-xs btn-ghost gap-1"
            @click="copyCode(block)"
          >
            <svg v-if="block.copied" class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.207a1.5 1.5 0 00-1.06-.44H6.5V3.5z" />
              <path d="M5 8.5A1.5 1.5 0 016.5 7h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0115 11.622V17.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 015 17.5v-9z" />
            </svg>
            <span class="text-xs">{{ block.copied ? 'Copied' : 'Copy' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-markdown :deep(pre.hljs) {
  background: #1e1e2e;
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.chat-markdown :deep(code:not(.hljs code)) {
  background: rgba(0,0,0,0.1);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
.chat-markdown :deep(.hljs) {
  background: transparent;
}
</style>