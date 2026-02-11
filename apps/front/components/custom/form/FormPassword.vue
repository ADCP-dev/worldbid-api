<script setup lang="ts">
import Input from "~/components/ui/input/Input.vue";
import Label from "~/components/ui/label/Label.vue";
import { ref } from "vue";
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
  <div class="relative space-y-2">
    <Label
      >{{ label }}<span v-if="required" class="text-red-600">*</span></Label
    >
    <div class="relative">
      <Input
        v-model="model"
        :placeholder="placeholder"
        :type="inputType"
        :disabled="disabled"
        class="pr-10"
      />
      <button
        type="button"
        class="absolute end-0 inset-y-0 flex items-center justify-center px-3 focus:outline-none cursor-pointer"
        tabindex="-1"
        @click="togglePasswordVisibility"
      >
        <!-- Lucide icons for password visibility -->
        <Eye v-if="isPasswordVisible" class="h-5 w-5 text-gray-500" />
        <EyeOff v-else class="h-5 w-5 text-gray-500" />
      </button>
    </div>
    <span
      v-if="slots['icon-start']"
      class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
    >
      <slot name="icon-start" />
    </span>
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
