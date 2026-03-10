<script setup lang="ts">
import { Eye } from "lucide-vue-next";

const emit = defineEmits(["click"]);

const props = defineProps<{
  ariaLabel: string;
  label?: string;
}>();
</script>

<template>
  <div class="tooltip" data-tip="Ver">
    <button
      type="button"
      class="btn btn-outline btn-sm p-0"
      :class="{ 'h-8 px-2 flex items-center justify-center gap-2': props.label, 'w-8 h-8': !props.label }"
      :aria-label="props.ariaLabel"
      @click="emit('click')"
    >
      <Eye class="w-4 h-4" />
      <span v-if="props.label">{{ props.label }}</span>
    </button>
  </div>
</template>
