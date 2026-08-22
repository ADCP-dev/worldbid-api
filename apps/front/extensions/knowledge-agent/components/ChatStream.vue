<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { useChatStream } from '../composables/useChatStream';
import ChatMessage from './ChatMessage.vue';
import ChatInput from './ChatInput.vue';

const props = defineProps<{
  sessionId: string;
}>();

const {
  messages,
  isStreaming,
  error,
  sendMessage,
  stopStreaming,
  resetMessages,
  loadSessionHistory,
} = useChatStream();

const scrollContainer = ref<HTMLElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    const el = scrollContainer.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

// Load persisted conversation history when the chat opens so reopening a
// session shows the prior messages (PostgresSaver-backed).
onMounted(() => {
  void loadSessionHistory(props.sessionId);
});

watch(() => messages.value.length, scrollToBottom, { immediate: true });
watch(
  () => messages.value[messages.value.length - 1]?.content,
  scrollToBottom,
);

function onSend(content: string) {
  void sendMessage(props.sessionId, content);
}

defineExpose({ resetMessages });
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Messages -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-2 py-4"
    >
      <div class="max-w-4xl mx-auto">
        <div v-if="messages.length === 0" class="text-center py-12 text-base-content/40">
          <p class="text-lg mb-2">Start a conversation</p>
          <p class="text-sm">The agent has access to your knowledge base notes.</p>
        </div>
        <ChatMessage
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          :is-streaming="isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id"
        />
      </div>
    </div>

    <!-- Error banner -->
    <div v-if="error" class="px-4 py-2 bg-error/10 text-error text-sm text-center">
      {{ error }}
      <button v-if="isStreaming" class="btn btn-xs btn-ghost ml-2" @click="stopStreaming">
        Stop
      </button>
    </div>

    <!-- Input -->
    <ChatInput
      :disabled="isStreaming"
      :placeholder="isStreaming ? 'Agent is responding...' : 'Send a message...'"
      @send="onSend"
    />
  </div>
</template>