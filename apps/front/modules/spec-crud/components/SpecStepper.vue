<script setup lang="ts">
/**
 * SpecStepper — wizard shell for SpecDataForm.
 *
 * Renders a horizontal progress bar (step numbers + titles), the current
 * step's content via slot, and Prev/Next/Finish buttons. Per-step validation
 * is delegated to `useSpecStepper` (the parent owns the composable instance
 * and passes it in via `stepper` prop). This keeps the component reusable
 * for non-spec wizards too — the slot contract is the only coupling.
 *
 * ## Slot contract
 *
 *   #step-{i}   — explicit content for step i (overrides default render).
 *                  Useful when a step needs custom layout beyond a field grid.
 *   default     — fallback content for the current step when no #step-{i}
 *                  slot is provided. SpecDataForm uses this to render the
 *                  current step's fields via SpecFieldInput.
 *
 * When NO default slot and NO #step-{i} slot is provided, the stepper renders
 * nothing for the body (the parent is expected to provide one or the other).
 *
 * ## Events
 *
 *   finish      — emitted when the user clicks Finish on the last step.
 *                  The parent is responsible for the final full-form
 *                  validation + submit. The stepper does NOT validate on
 *                  finish (the parent may want to surface errors from ALL
 *                  steps, not just the current one).
 *   advance     — emitted after a successful `next()` (parent can hook for
 *                  analytics / scroll-to-top).
 *   back        — emitted after `prev()`.
 *
 * ## DaisyUI
 *
 * Uses DaisyUI button + progress classes. The step indicator is a custom
 * horizontal flex (DaisyUI `steps` class is not reliably available across
 * Tailwind 4 / DaisyUI 5 themes in this project, so we use explicit classes
 * that match the project's design tokens).
 */
import { computed, useSlots } from 'vue'
import type { Ref } from 'vue'
import type { SpecStep } from '../composables/useSpecStepper'

/**
 * The stepper shape passed in from the parent. We accept a ref-wrapped
 * return of `useSpecStepper` directly — this avoids re-creating the
 * composable inside the component and keeps the parent the single owner of
 * form state.
 */
export interface StepperHandle {
  currentStep: Ref<number>
  totalSteps: Ref<number> | number
  isFirst: Ref<boolean> | boolean
  isLast: Ref<boolean> | boolean
  canNext: Ref<boolean> | boolean
  stepErrors: Ref<Record<string, string>>
  next: () => boolean
  prev: () => void
  goTo: (i: number) => void
  isStepValid: (i: number) => boolean
  reset: () => void
}

const props = defineProps<{
  /** Steps (titles + icons) for the progress bar. */
  steps: SpecStep[]
  /** Stepper handle from `useSpecStepper`. The parent owns the instance. */
  stepper: StepperHandle
  /** Disable all navigation (e.g. while submitting). Default false. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  finish: []
  advance: [stepIndex: number]
  back: [stepIndex: number]
}>()

const slots = useSlots()

/** Unwrap handle fields to plain values for template use. */
const currentStep = computed(() => props.stepper.currentStep.value)
const totalSteps = computed(() =>
  typeof props.stepper.totalSteps === 'number'
    ? props.stepper.totalSteps
    : props.stepper.totalSteps.value,
)
const isFirst = computed(() =>
  typeof props.stepper.isFirst === 'boolean'
    ? props.stepper.isFirst
    : props.stepper.isFirst.value,
)
const isLast = computed(() =>
  typeof props.stepper.isLast === 'boolean'
    ? props.stepper.isLast
    : props.stepper.isLast.value,
)
const canNext = computed(() =>
  typeof props.stepper.canNext === 'boolean'
    ? props.stepper.canNext
    : props.stepper.canNext.value,
)
const stepErrors = computed(() => props.stepper.stepErrors.value)

/** Whether a named #step-{i} slot exists for step i. */
function hasStepSlot(i: number): boolean {
  const name = `step-${i}`
  return Boolean(slots[name])
}

/** Whether the default slot is provided. */
const hasDefaultSlot = computed(() => Boolean(slots.default))

/** Status of step i for the progress bar: 'done' | 'current' | 'todo'. */
function stepStatus(i: number): 'done' | 'current' | 'todo' {
  if (i < currentStep.value) return 'done'
  if (i === currentStep.value) return 'current'
  return 'todo'
}

/** Click handler for a step indicator — jumps to that step if allowed. */
function onStepClick(i: number) {
  if (props.disabled) return
  // Allow jumping back to any completed step; only allow forward jump when
  // the current step is valid (matches typical wizard UX).
  if (i <= currentStep.value) {
    props.stepper.goTo(i)
    return
  }
  // Forward jump: validate current step first.
  if (props.stepper.isStepValid(currentStep.value)) {
    props.stepper.goTo(i)
  }
}

function onNext() {
  if (props.disabled) return
  const ok = props.stepper.next()
  if (ok) emit('advance', currentStep.value)
}

function onPrev() {
  if (props.disabled) return
  props.stepper.prev()
  emit('back', currentStep.value)
}

function onFinish() {
  if (props.disabled) return
  emit('finish')
}

/** Icon for a step: uses step.icon if provided, else the step number. */
function stepIcon(step: SpecStep, i: number): string {
  return step.icon ?? String(i + 1)
}
</script>

<template>
  <div class="spec-stepper w-full">
    <!-- Progress bar -->
    <ol
      class="flex items-center w-full mb-6 gap-2"
      role="list"
      aria-label="Form steps"
    >
      <li
        v-for="(step, i) in steps"
        :key="step.id ?? step.title"
        class="flex items-center flex-1 min-w-0"
      >
        <button
          type="button"
          class="flex items-center gap-2 group focus:outline-none"
          :class="[
            stepStatus(i) === 'current' ? 'text-primary' : '',
            stepStatus(i) === 'done' ? 'text-success' : '',
            stepStatus(i) === 'todo' ? 'text-base-content/40' : '',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          ]"
          :aria-current="stepStatus(i) === 'current' ? 'step' : undefined"
          :disabled="disabled"
          @click="onStepClick(i)"
        >
          <span
            class="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors shrink-0"
            :class="[
              stepStatus(i) === 'current'
                ? 'border-primary bg-primary text-primary-content'
                : '',
              stepStatus(i) === 'done'
                ? 'border-success bg-success text-success-content'
                : '',
              stepStatus(i) === 'todo'
                ? 'border-base-content/20 bg-base-100 text-base-content/40'
                : '',
            ]"
          >
            <span v-if="stepStatus(i) === 'done'" aria-hidden="true">✓</span>
            <span v-else>{{ stepIcon(step, i) }}</span>
          </span>
          <span
            class="text-sm font-medium truncate hidden sm:inline"
            :class="stepStatus(i) === 'todo' ? 'opacity-60' : ''"
          >
            {{ step.title }}
          </span>
        </button>
        <span
          v-if="i < steps.length - 1"
          class="flex-1 h-0.5 mx-2 transition-colors"
          :class="stepStatus(i) === 'done' ? 'bg-success' : 'bg-base-content/20'"
          aria-hidden="true"
        />
      </li>
    </ol>

    <!-- Step errors (current step) -->
    <div
      v-if="Object.keys(stepErrors).length > 0"
      class="alert alert-warning mb-4"
      role="alert"
    >
      <span class="text-sm">
        Please fix the highlighted fields before continuing.
      </span>
    </div>

    <!-- Step body: explicit #step-{i} slot wins, else default slot -->
    <div class="spec-stepper-body mb-6">
      <template v-if="hasStepSlot(currentStep)">
        <slot :name="`step-${currentStep}`" :step-index="currentStep" />
      </template>
      <template v-else-if="hasDefaultSlot">
        <slot :step-index="currentStep" />
      </template>
      <template v-else>
        <!-- No slot provided — render nothing. Parent should provide one. -->
      </template>
    </div>

    <!-- Navigation buttons -->
    <div class="flex items-center justify-between gap-3 mt-6">
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="isFirst || disabled"
        @click="onPrev"
      >
        ← Previous
      </button>
      <div class="flex items-center gap-3">
        <span class="text-sm text-base-content/60">
          Step {{ currentStep + 1 }} of {{ totalSteps }}
        </span>
        <button
          v-if="!isLast"
          type="button"
          class="btn btn-primary"
          :disabled="!canNext || disabled"
          @click="onNext"
        >
          Next →
        </button>
        <button
          v-else
          type="button"
          class="btn btn-primary"
          :disabled="disabled"
          @click="onFinish"
        >
          Finish
        </button>
      </div>
    </div>
  </div>
</template>