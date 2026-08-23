<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Minus, Plus } from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  unit?: string;
}>(), {
  step: 1,
  disabled: false,
});

const emit = defineEmits<{ (e: 'blur'): void }>();
const slots = useSlots();
const { t } = useI18n();

const model = defineModel<number>({ default: 0 });

const innerError = ref('');
const hasError = computed(() => Boolean(props.error || innerError.value));

function clamp(value: number): number {
  let v = value;
  if (props.min !== undefined) v = Math.max(props.min, v);
  if (props.max !== undefined) v = Math.min(props.max, v);
  return v;
}

function increment(): void {
  if (props.disabled) return;
  const next = model.value + props.step;
  if (props.max !== undefined && next > props.max) {
    model.value = props.max;
    return;
  }
  model.value = next;
}

function decrement(): void {
  if (props.disabled) return;
  const next = model.value - props.step;
  if (props.min !== undefined && next < props.min) {
    model.value = props.min;
    return;
  }
  model.value = next;
}

function validateRange(value: number): boolean {
  if (props.min !== undefined && value < props.min) return false;
  if (props.max !== undefined && value > props.max) return false;
  return true;
}

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  const num = Number(raw);
  if (raw === '' || !Number.isFinite(num)) {
    innerError.value = t('mod.app.scheduling.numericStepper.errors.invalid');
    return;
  }
  if (!validateRange(num)) {
    innerError.value = t('mod.app.scheduling.numericStepper.errors.range', {
      min: props.min ?? '−∞',
      max: props.max ?? '∞',
    });
    return;
  }
  innerError.value = '';
  model.value = num;
}

function onBlur(): void {
  // snap out-of-range direct input back into bounds
  if (innerError.value) model.value = clamp(model.value);
  innerError.value = '';
  emit('blur');
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <div class="join w-full">
      <button
        type="button"
        class="btn btn-outline join-item"
        :disabled="disabled || (min !== undefined && model <= min)"
        :aria-label="$t('mod.app.scheduling.numericStepper.decrement')"
        @click="decrement"
      >
        <Minus class="h-4 w-4" />
      </button>

      <input
        type="number"
        :value="model"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        class="input input-bordered join-item w-full text-center"
        :class="{ 'input-error': hasError }"
        @input="onInput"
        @blur="onBlur"
      >

      <button
        type="button"
        class="btn btn-outline join-item"
        :disabled="disabled || (max !== undefined && model >= max)"
        :aria-label="$t('mod.app.scheduling.numericStepper.increment')"
        @click="increment"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>

    <label v-if="unit" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ unit }}</span>
    </label>

    <label v-if="description" class="label py-1">
      <span class="label-text-alt text-base-content/60">{{ description }}</span>
    </label>

    <div v-if="slots.hint" class="mt-1">
      <slot name="hint" />
    </div>

    <label v-if="hasError" class="label py-0">
      <span class="label-text-alt text-error font-medium">{{ error || innerError }}</span>
    </label>
  </div>
</template>