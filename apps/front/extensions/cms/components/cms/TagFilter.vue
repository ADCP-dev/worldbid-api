<script setup lang="ts">
export interface TagOption {
  id: string;
  slug: string;
  name: string;
  count?: number;
}

const props = defineProps<{
  tags: TagOption[];
  modelValue: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

function isActive(slug: string) {
  return props.modelValue.includes(slug);
}

function toggle(tag: TagOption) {
  const current = [...props.modelValue];
  const idx = current.indexOf(tag.slug);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(tag.slug);
  }
  emit('update:modelValue', current);
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="tag in tags"
      :key="tag.slug"
      type="button"
      :class="[
        'badge badge-lg cursor-pointer transition-colors',
        isActive(tag.slug) ? 'badge-primary' : 'badge-outline hover:badge-ghost'
      ]"
      @click="toggle(tag)"
    >
      {{ tag.name }}
      <span v-if="tag.count != null" class="opacity-60 ml-1">{{ tag.count }}</span>
    </button>
  </div>
</template>
