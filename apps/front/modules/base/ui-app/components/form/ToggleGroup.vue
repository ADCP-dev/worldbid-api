<script setup lang="ts">
/**
 * ToggleGroup — grupo de toggles seleccionables (multi o single mode).
 * pathPrefix: false (carpeta form). Componente: <ToggleGroup>.
 */
import { computed, nextTick, ref } from 'vue'
import type { ToggleOption } from '@base/ui-app/components/automation/types'

const props = defineProps<{
  modelValue: string[] | string
  options: ToggleOption[]
  multiple?: boolean
  label?: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[] | string): void
}>()

const multiple = computed(() => props.multiple ?? true)
const btnRefs = ref<HTMLElement[]>([])
const activeIndex = ref(-1)

function isSelected(value: string): boolean {
  if (multiple.value) {
    return Array.isArray(props.modelValue) && props.modelValue.includes(value)
  }
  return props.modelValue === value
}

function toggle(value: string) {
  if (props.disabled) return
  if (multiple.value) {
    const arr = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = arr.indexOf(value)
    if (idx === -1) arr.push(value)
    else arr.splice(idx, 1)
    emit('update:modelValue', arr)
  } else {
    emit('update:modelValue', value)
  }
}

function focusBtn(idx: number) {
  const el = btnRefs.value[idx]
  if (el) el.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || props.options.length === 0) return
  const len = props.options.length
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    activeIndex.value = (activeIndex.value + 1) % len
    event.preventDefault()
    nextTick(() => focusBtn(activeIndex.value))
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    activeIndex.value = (activeIndex.value - 1 + len) % len
    event.preventDefault()
    nextTick(() => focusBtn(activeIndex.value))
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (activeIndex.value >= 0 && activeIndex.value < len) {
      toggle(props.options[activeIndex.value]?.value ?? '')
      event.preventDefault()
    }
  } else if (event.key === 'Escape') {
    activeIndex.value = -1
  }
}

const groupRole = computed(() => (multiple.value ? 'group' : 'radiogroup'))
const itemRole = computed(() => (multiple.value ? 'checkbox' : 'radio'))
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>

    <div
      :role="groupRole"
      class="flex flex-wrap gap-2"
      @keydown="onKeydown"
    >
      <button
        v-for="(opt, idx) in options"
        :key="opt.value"
        :ref="(el) => { if (el) btnRefs[idx] = el as HTMLElement }"
        type="button"
        :role="itemRole"
        :aria-checked="isSelected(opt.value)"
        :tabindex="activeIndex === idx ? 0 : -1"
        :disabled="disabled"
        class="btn btn-outline gap-2"
        :class="{ 'btn-active btn-primary': isSelected(opt.value), 'btn-disabled': disabled }"
        @click="toggle(opt.value)"
        @focus="activeIndex = idx"
      >
        <component
          v-if="opt.icon"
          :is="opt.icon"
          class="h-4 w-4"
        />
        <span>{{ opt.label }}</span>
      </button>
    </div>

    <label v-if="error" class="label py-1">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>