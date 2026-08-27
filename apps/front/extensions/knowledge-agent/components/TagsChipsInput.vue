<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const { t } = useI18n();
const draft = ref('');

const tags = computed(() => props.modelValue ?? []);

function addTagsFromDraft(): void {
  const raw = draft.value.trim();
  if (!raw) return;
  // Accept comma or Enter separated input — "a, b, c" adds three tags.
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && !tags.value.includes(s));
  if (parts.length > 0) {
    emit('update:modelValue', [...tags.value, ...parts]);
  }
  draft.value = '';
}

function removeTag(tag: string): void {
  emit('update:modelValue', tags.value.filter((t) => t !== tag));
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTagsFromDraft();
  } else if (e.key === 'Backspace' && draft.value === '' && tags.value.length > 0) {
    removeTag(tags.value[tags.value.length - 1]);
  }
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1.5 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 min-h-[38px] focus-within:border-primary/60"
  >
    <span
      v-for="tag in tags"
      :key="tag"
      class="inline-flex items-center gap-1 rounded-full bg-secondary/15 text-secondary-content text-xs font-medium px-2 py-0.5 border border-secondary/30"
    >
      <span>#{{ tag }}</span>
      <button
        type="button"
        class="hover:text-error transition-colors"
        :aria-label="t('ext.ka.notes.removeTag', 'Remove tag')"
        @click="removeTag(tag)"
      >
        <X :size="11" />
      </button>
    </span>
    <input
      v-model="draft"
      type="text"
      :placeholder="placeholder ?? t('ext.ka.notes.tagsPlaceholder', 'tags — press Enter to add')"
      class="flex-1 min-w-[140px] bg-transparent outline-none text-sm py-0.5"
      @keydown="onKeydown"
      @blur="addTagsFromDraft"
    >
  </div>
</template>
