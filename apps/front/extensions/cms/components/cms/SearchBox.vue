<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
}>(), {
  modelValue: '',
  placeholder: 'Buscar...',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const local = ref(props.modelValue);
let timer: ReturnType<typeof setTimeout>;

watch(() => props.modelValue, (v) => { local.value = v; });

function onInput(val: string) {
  local.value = val;
  clearTimeout(timer);
  timer = setTimeout(() => emit('update:modelValue', val), 300);
}
</script>

<template>
  <div class="relative">
    <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      :value="local"
      type="text"
      :placeholder="placeholder"
      class="input input-bordered input-sm pl-9 w-full"
      @input="onInput(($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
