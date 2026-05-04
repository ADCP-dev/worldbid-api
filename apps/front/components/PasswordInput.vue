<script setup lang="ts">
import type { ComponentFieldBindingObject } from 'vee-validate'
import type { HTMLAttributes } from 'vue'
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
  componentField?: ComponentFieldBindingObject<any>
  autocomplete?: string
  modelValue?: string
  placeholder?: string
}>()

const model = useModel(props, 'modelValue')

const showPassword = ref(false)
</script>

<template>
  <label :class="['input flex items-center gap-2 w-full', props.class]">
    <input
      v-model="model"
      :type="showPassword ? 'text' : 'password'"
      class="grow w-full"
      :placeholder="props.placeholder || 'Enter your password'"
      :disabled="props.disabled"
      :autocomplete="props.autocomplete"
      v-bind="props.componentField"
    >
    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      :disabled="props.disabled"
      @click="showPassword = !showPassword"
    >
      <AppIcon
        :name="showPassword ? 'LucideEye' : 'LucideEyeOff'"
        class="size-4 opacity-70"
        aria-hidden="true"
      />
      <span class="sr-only">
        {{ showPassword ? "Show password" : "Hide password" }}
      </span>
    </button>
  </label>
</template>
