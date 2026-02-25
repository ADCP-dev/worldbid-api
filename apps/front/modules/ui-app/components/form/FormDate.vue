<script setup lang="ts">
import { computed } from "vue";
import {
  getLocalTimeZone,
  CalendarDate,
  type DateValue,
} from "@internationalized/date";
import { CalendarIcon } from "lucide-vue-next";

const props = defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
}>();

const date = defineModel<DateValue | null>({ required: true });

// Convert DateValue to YYYY-MM-DD string for native input
const dateString = computed({
  get: () => {
    if (!date.value) return "";
    const d = date.value;
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  },
  set: (val: string) => {
    if (!val) {
      date.value = null;
      return;
    }
    const parts = val.split('-').map(Number);
    if (parts.length === 3 && parts.every(p => !isNaN(p))) {
      const year = parts[0] as number;
      const month = parts[1] as number;
      const day = parts[2] as number;
      date.value = new CalendarDate(year, month, day);
    }
  }
});
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="relative">
      <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-base-content/50 z-10">
        <CalendarIcon class="h-4 w-4" />
      </div>
      <input
        v-model="dateString"
        type="date"
        :disabled="disabled"
        :placeholder="placeholder"
        class="input input-bordered w-full pl-10"
        :class="{ 'input-error': error }"
      />
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>

<style scoped>
/* Adjust native date picker icon position if needed */
input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.5;
}
input[type="date"]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}
</style>
