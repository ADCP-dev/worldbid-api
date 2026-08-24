<script setup lang="ts">
import { ref, nextTick } from 'vue';

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const text = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

function submit() {
  const content = text.value.trim();
  if (!content || props.disabled) return;
  emit('send', content);
  text.value = '';
  nextTick(autoResize);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="border-t bg-base-100 p-3">
    <div class="flex items-end gap-2 max-w-4xl mx-auto">
      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="placeholder ?? 'Send a message...'"
        :disabled="disabled"
        rows="1"
        class="textarea textarea-bordered flex-1 resize-none leading-normal"
        style="max-height: 200px;"
        @input="autoResize"
        @keydown="onKeydown"
      />
      <button
        class="btn btn-primary btn-square"
        :disabled="disabled || !text.trim()"
        @click="submit"
      >
        <span v-if="disabled" class="loading loading-spinner loading-sm"/>
        <svg v-else class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3.105 3.105a.75.75 0 01.848-.18l13 6.5a.75.75 0 010 1.35l-13 6.5a.75.75 0 01-1.06-.82L4.56 10 1.893 5.925a.75.75 0 01.212-.82z" />
        </svg>
      </button>
    </div>
    <p class="text-xs text-base-content/40 text-center mt-1">
      Enter to send · Shift+Enter for newline
    </p>
  </div>
</template>