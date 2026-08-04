/**
 * useSpecStepper — wizard/stepper state machine for SpecDataForm.
 *
 * Owns the current step index and per-step validation. Designed to be used by
 * `SpecStepper.vue` (the visual shell) and driven by `SpecDataForm.vue` (the
 * form owner). The composable does NOT render anything; it only manages state.
 *
 * ## Validation contract
 *
 * Each step optionally declares `fields: string[]` (the field names rendered
 * in that step). When present, `next()` validates ONLY those fields against
 * the current `formState` using `buildZodSchemaSubset`. When absent, the step
 * validates ALL visible (non-hidden) fields — this matches the spec
 * "validate only the visible step" scenario.
 *
 * Validation is synchronous (FieldValidationSpec rules are sync: min/max/
 * pattern/email/url). Async rules are out of scope (documented in design
 * risk table).
 *
 * ## Exposed surface
 *
 *   currentStep  — reactive ref<number> (0-indexed)
 *   totalSteps   — computed number
 *   isFirst      — computed boolean
 *   isLast       — computed boolean
 *   canNext      — computed boolean (current step is valid AND not last)
 *   next()       — validate current step; if valid, advance; returns success
 *   prev()       — move back unconditionally (no validation)
 *   goTo(i)      — jump to step i (clamped); validates intermediate steps
 *                  is NOT enforced (matches typical wizard UX)
 *   isStepValid(i) — validate step i against formState without advancing
 *   stepErrors   — reactive ref<Record<string, string>> for the current step
 *   reset()      — back to step 0, clear errors
 *
 * ## Parent gate
 *
 * The parent can block advance by setting `blockNext` (a ref or getter). This
 * is useful when the parent has its own async validation (e.g. uniqueness
 * check) that the stepper can't see. `canNext` is false while `blockNext` is
 * truthy.
 */
import { ref, computed, type Ref, type MaybeRefOrGetter, toValue } from 'vue'
import { buildZodSchemaSubset, collectZodErrors } from './useSpecValidation'
import type { ValidatedFieldSpec } from './useSpecValidation'
import type { FieldSpec } from './useSpecResource'

/** A step definition (subset of backend StepSpec that the stepper needs). */
export interface SpecStep {
  id?: string
  title: string
  icon?: string
  /** Field names rendered in this step. When omitted, ALL visible fields. */
  fields?: string[]
}

/**
 * @param steps      Step definitions (from ResourceUISpec.steps).
 * @param formState  Reactive ref to the form state (Record<string, unknown>).
 * @param fields     Full field list (to build per-step Zod subsets).
 * @param blockNext  Optional ref/getter that, when truthy, blocks `next()`.
 *                   Used by the parent to gate advance on custom validation.
 */
export function useSpecStepper(
  steps: MaybeRefOrGetter<SpecStep[]>,
  formState: Ref<Record<string, unknown>>,
  fields: MaybeRefOrGetter<ValidatedFieldSpec[]>,
  blockNext?: MaybeRefOrGetter<boolean | undefined>,
) {
  const currentStep = ref(0)
  const stepErrors = ref<Record<string, string>>({})

  const stepsRef = computed(() => toValue(steps))
  const fieldsRef = computed(() => toValue(fields))
  const blockRef = computed(() => Boolean(toValue(blockNext)))

  const totalSteps = computed(() => stepsRef.value.length)
  const isFirst = computed(() => currentStep.value === 0)
  const isLast = computed(() => currentStep.value === totalSteps.value - 1)

  /** Resolve the field names that belong to step `i`. */
  function stepFieldNames(i: number): string[] | undefined {
    const step = stepsRef.value[i]
    return step?.fields
  }

  /**
   * Validate step `i` against the current formState. Returns true if valid;
   * populates `stepErrors` with the first issue per field when invalid.
   * When `step.fields` is undefined, validates ALL visible (non-hidden)
   * fields — the caller is responsible for excluding showIf-hidden fields
   * from the `fields` list passed to the composable.
   */
  function isStepValid(i: number): boolean {
    const names = stepFieldNames(i)
    const allFields = fieldsRef.value
    const subset = names && names.length ? names : allFields.map((f) => f.name)
    const schema = buildZodSchemaSubset(allFields, subset)
    const result = schema.safeParse(formState.value)
    if (!result.success) {
      stepErrors.value = collectZodErrors(result.error.issues)
      return false
    }
    // Clear errors for this step on success.
    stepErrors.value = {}
    return true
  }

  /** Whether the current step can advance (valid AND not last AND not blocked). */
  const canNext = computed(() => {
    if (isLast.value) return false
    if (blockRef.value) return false
    return isStepValid(currentStep.value)
  })

  /**
   * Validate the current step; if valid, advance. Returns true on success.
   * Does nothing (returns false) when on the last step or blocked.
   */
  function next(): boolean {
    if (isLast.value) return false
    if (blockRef.value) return false
    if (!isStepValid(currentStep.value)) return false
    currentStep.value = Math.min(currentStep.value + 1, totalSteps.value - 1)
    stepErrors.value = {}
    return true
  }

  /** Move back unconditionally (no validation). Stays clamped at 0. */
  function prev(): void {
    currentStep.value = Math.max(currentStep.value - 1, 0)
    stepErrors.value = {}
  }

  /**
   * Jump to step `i` (clamped). Intermediate steps are NOT validated — this
   * matches typical wizard UX (users can click a completed step to revisit).
   * The parent can block this by setting `blockNext`.
   */
  function goTo(i: number): void {
    if (blockRef.value) return
    const target = Math.max(0, Math.min(i, totalSteps.value - 1))
    currentStep.value = target
    stepErrors.value = {}
  }

  /** Reset to step 0 and clear errors. */
  function reset(): void {
    currentStep.value = 0
    stepErrors.value = {}
  }

  return {
    currentStep,
    totalSteps,
    isFirst,
    isLast,
    canNext,
    stepErrors,
    next,
    prev,
    goTo,
    isStepValid,
    reset,
  }
}

/**
 * Narrow `FieldSpec[]` to `ValidatedFieldSpec[]` for the stepper. The shapes
 * are structurally compatible (ValidatedFieldSpec just adds the optional
 * `validation` field). This helper keeps the call site clean.
 */
export function asValidatedFields(
  fields: FieldSpec[],
): ValidatedFieldSpec[] {
  return fields as ValidatedFieldSpec[]
}