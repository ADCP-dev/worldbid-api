<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { SendHorizonal } from 'lucide-vue-next';

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const { t } = useI18n();

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
  <div class="border-t border-base-300 bg-base-100 p-3">
    <div class="flex items-end gap-2 max-w-4xl mx-auto">
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
        :disabled="disabled || !text.trim()"
        :aria-label="t('ext.ka.chat.send', 'Send message')"
        @click="submit"
      >
        <span v-if="disabled" class="loading loading-spinner loading-sm"/>
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
</template>
