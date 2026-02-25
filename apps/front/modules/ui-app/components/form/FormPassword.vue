<script setup lang="ts">
import { ref, computed, useSlots } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
}>();

const model = defineModel<string>();
const slots = useSlots();

// Password visibility toggle functionality
const isPasswordVisible = ref(false);
const inputType = computed(() =>
  isPasswordVisible.value ? "text" : "password"
);

const togglePasswordVisibility = () => {
  isPasswordVisible.value = !isPasswordVisible.value;
};
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="relative">
      <input
        v-model="model"
        :type="inputType"
        :placeholder="placeholder"
        :disabled="disabled"
        class="input input-bordered w-full pr-10"
        :class="{ 'input-error': error, 'pl-10': slots['icon-start'] }"
      />

      <span
        v-if="slots['icon-start']"
        class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-base-content/50"
      >
        <slot name="icon-start" />
      </span>

      <button
        type="button"
        class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center px-3 focus:outline-none cursor-pointer text-base-content/50 hover:text-base-content transition-colors"
        tabindex="-1"
        @click="togglePasswordVisibility"
      >
        <!-- Lucide icons for password visibility -->
        <Eye v-if="isPasswordVisible" class="h-5 w-5" />
        <EyeOff v-else class="h-5 w-5" />
      </button>
    </div>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <label v-if="error" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>
