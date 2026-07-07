<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Check } from 'lucide-vue-next'
import type { RadioCardOption } from './types'

const props = defineProps<{
  modelValue: string
  options: RadioCardOption[]
  label?: string
  columns?: 1 | 2 | 3 | 4
  disabled?: boolean
  error?: string
}>()

const model = defineModel<string>({ required: true })

const cols = computed(() => props.columns ?? 3)
const gridClass = computed(() => {
  const map: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }
  return map[cols.value] ?? map[3]
})

const cardRefs = ref<HTMLElement[]>([])
const activeIndex = ref(-1)

function isSelected(value: string): boolean {
  return model.value === value
}

function select(value: string) {
  if (props.disabled) return
  model.value = value
}

function focusCard(idx: number) {
  const el = cardRefs.value[idx]
  if (el) el.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || props.options.length === 0) return
  const len = props.options.length
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    activeIndex.value = (activeIndex.value + 1) % len
    event.preventDefault()
    nextTick(() => focusCard(activeIndex.value))
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    activeIndex.value = (activeIndex.value - 1 + len) % len
    event.preventDefault()
    nextTick(() => focusCard(activeIndex.value))
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (activeIndex.value >= 0 && activeIndex.value < len) {
      select(props.options[activeIndex.value]?.value ?? '')
      event.preventDefault()
    }
  }
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>

    <div
      role="radiogroup"
      class="grid gap-3"
      :class="gridClass"
      @keydown="onKeydown"
    >
      <button
        v-for="(opt, idx) in options"
        :key="opt.value"
        :ref="(el) => { if (el) cardRefs[idx] = el as HTMLElement }"
        type="button"
        role="radio"
        :aria-checked="isSelected(opt.value)"
        :tabindex="activeIndex === idx || (activeIndex === -1 && isSelected(opt.value)) ? 0 : -1"
        :disabled="disabled"
        class="card text-left border-2 transition-all bg-base-100 hover:bg-base-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        :class="isSelected(opt.value) ? 'border-primary bg-primary/5' : 'border-base-content/10'"
        @click="select(opt.value)"
        @focus="activeIndex = idx"
      >
        <div class="card-body p-4 flex-row items-start gap-3">
          <component
            v-if="opt.icon"
            :is="opt.icon"
            class="h-6 w-6 shrink-0 mt-0.5"
            :class="isSelected(opt.value) ? 'text-primary' : 'text-base-content/60'"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ opt.label }}</span>
              <Check
                v-if="isSelected(opt.value)"
                class="h-4 w-4 text-primary shrink-0"
              />
            </div>
            <p v-if="opt.description" class="text-sm text-base-content/60 mt-1">
              {{ opt.description }}
            </p>
          </div>
        </div>
      </button>
    </div>

    <label v-if="error" class="label py-1">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>