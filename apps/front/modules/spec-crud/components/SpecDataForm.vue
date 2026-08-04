<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'
import SpecFieldInput from './SpecFieldInput.vue'
import SpecStepper from './SpecStepper.vue'
import { useSpecSubmit } from '../composables/useSpecSubmit'
import {
  buildZodSchema,
  collectZodErrors,
  type ValidatedFieldSpec,
} from '../composables/useSpecValidation'
import {
  useSpecStepper,
  asValidatedFields,
  type SpecStep,
} from '../composables/useSpecStepper'

const props = defineProps<{
  resource: string
  mode: 'create' | 'edit'
  id?: string | number
}>()

/**
 * Best-effort singularization of a route resource name:
 *   "tasks"        → "Task"
 *   "task-comments"→ "Task Comment"
 *   "users"        → "User"
 * Handles the common English plural suffixes (s, es, ies). Falls back
 * to title-casing the input when no rule matches. Used only when the
 * spec doesn't declare `displayName` or `ui.singular`.
 */
function singularize(name: string): string {
  const words = name.split(/[-_]/).map((w) => {
    if (/ies$/i.test(w)) return w.slice(0, -3) + 'y'
    if (/sses$/i.test(w)) return w.slice(0, -2) // "classes" → "class"
    if (/es$/i.test(w) && !/(s|ss|ch|sh|x|z)es$/i.test(w)) return w.slice(0, -2)
    if (/s$/i.test(w) && !/ss$/i.test(w)) return w.slice(0, -1)
    return w
  })
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const specCrud = useSpecResource()
const router = useRouter()

const spec = specCrud.getResource(props.resource)

const saving = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const form = ref<Record<string, unknown>>({})

/** Active tab index (for tabbed forms). -1 when tabs are not used. */
const activeTab = ref(0)

const { data: existingRecord, isLoading: loading } = specCrud.useFindOneQuery(
  () => props.resource,
  () => props.id,
)

/* ------------------------------------------------------------------ *
 * Field selection — respects ui.formFields, readOnly, and showIf.
 * showIf is evaluated reactively so hidden fields are excluded from
 * BOTH rendering AND the submitted payload.
 * ------------------------------------------------------------------ */

/**
 * Evaluate a `showIf` condition against the current form state.
 * - `true`  → always visible
 * - `false` → always hidden
 * - object  → every key must match the form value (AND semantics)
 *   e.g. `{ hasCoupon: true }` → visible only when form.hasCoupon === true
 * Returns true when the field should be rendered.
 */
function evalShowIf(
  showIf: boolean | Record<string, unknown> | undefined,
  formState: Record<string, unknown>,
): boolean {
  if (showIf === undefined) return true
  if (typeof showIf === 'boolean') return showIf
  for (const [key, expected] of Object.entries(showIf)) {
    if (formState[key] !== expected) return false
  }
  return true
}

/** All editable fields (readOnly filtered for create; shown for edit). */
const allFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  return spec.value.fields.filter(
    (f) => !f.readOnly || props.mode === 'edit',
  )
})

/** Fields restricted to ui.formFields when declared. */
const declaredFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.formFields
  if (names && names.length) {
    return names
      .map((n) => allFields.value.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  return allFields.value
})

/**
 * Fields currently visible (showIf evaluated against form state). Reactive
 * — re-evaluates whenever `form` changes. Hidden fields are excluded from
 * rendering AND from the payload (see `submit()`).
 */
const visibleFields = computed<FieldSpec[]>(() => {
  return declaredFields.value.filter((f) =>
    evalShowIf(f.ui?.showIf, form.value),
  )
})

/* ------------------------------------------------------------------ *
 * Layout mode — steps > tabs > sections > simple grid.
 * Precedence per spec: if multiple are defined, the higher-precedence one
 * wins. Steps render a wizard (with sections inside each step if both are
 * set). Tabs render a tab bar. Sections render titled fieldsets. None →
 * the pre-change 2-column grid (backward compat).
 * ------------------------------------------------------------------ */

type LayoutMode = 'steps' | 'tabs' | 'sections' | 'simple'

const layoutMode = computed<LayoutMode>(() => {
  const ui = spec.value?.ui
  if (!ui) return 'simple'
  if (ui.steps && ui.steps.length) return 'steps'
  if (ui.tabs && ui.tabs.length) return 'tabs'
  if (ui.sections && ui.sections.length) return 'sections'
  return 'simple'
})

/* ------------------------------------------------------------------ *
 * Field ordering — respect `ui.order` (ascending; ties preserve
 * declaration order). Applied within each rendering group (section,
 * tab, step, or the simple grid).
 * ------------------------------------------------------------------ */

function orderedFields(fields: FieldSpec[]): FieldSpec[] {
  return [...fields].sort((a, b) => {
    const oa = a.ui?.order ?? Number.MAX_SAFE_INTEGER
    const ob = b.ui?.order ?? Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    return 0 // preserve declaration order on ties
  })
}

/* ------------------------------------------------------------------ *
 * Grid column span — `ui.cols` controls how many of the 4-column grid
 * a field spans. Default is 2 (matches pre-change 2-col grid). Values
 * are clamped to [1, 4].
 * ------------------------------------------------------------------ */

function colClass(field: FieldSpec): string {
  const cols = field.ui?.cols
  if (cols === undefined) {
    // Pre-change default: 2 columns on md+ (grid-cols-2). We use a 4-col
    // grid and span 2 by default to keep the same visual density.
    return 'md:col-span-2'
  }
  const clamped = Math.max(1, Math.min(4, Math.floor(cols)))
  return `md:col-span-${clamped}`
}

/* ------------------------------------------------------------------ *
 * Sections — group visible fields by `field.ui.section`. Fields
 * without a section land in a default trailing group. When
 * `ui.sections[].fields` is declared, it overrides the auto-grouping.
 * ------------------------------------------------------------------ */

interface RenderedSection {
  id: string
  title: string
  icon?: string
  cols?: number
  fields: FieldSpec[]
}

const renderedSections = computed<RenderedSection[]>(() => {
  const ui = spec.value?.ui
  const sections = ui?.sections ?? []
  const visible = visibleFields.value

  // When sections[].fields is declared, use it to assign fields.
  if (sections.length && sections.some((s) => s.fields && s.fields.length)) {
    const byName = new Map(visible.map((f) => [f.name, f]))
    return sections.map((s, i) => ({
      id: s.id ?? `section-${i}`,
      title: s.title,
      icon: s.icon,
      cols: s.cols,
      fields: orderedFields(
        (s.fields ?? [])
          .map((n) => byName.get(n))
          .filter((f): f is FieldSpec => !!f),
      ),
    }))
  }

  // Auto-group by field.ui.section. Fields without a section go to a
  // trailing "Other" group (only when at least one section is declared).
  if (sections.length) {
    const groups = new Map<string, FieldSpec[]>()
    const sectionOrder: string[] = sections.map((s, i) => s.id ?? s.title ?? `section-${i}`)
    const orphan: FieldSpec[] = []
    for (const f of visible) {
      const sec = f.ui?.section
      if (sec && sectionOrder.includes(sec)) {
        if (!groups.has(sec)) groups.set(sec, [])
        groups.get(sec)!.push(f)
      } else if (sec) {
        // section name not in declared sections — treat as orphan so it
        // still renders (visible) but without a titled fieldset.
        if (!groups.has(sec)) groups.set(sec, [])
        groups.get(sec)!.push(f)
      } else {
        orphan.push(f)
      }
    }
    const out: RenderedSection[] = sections.map((s, i) => {
      const id = s.id ?? s.title ?? `section-${i}`
      return {
        id,
        title: s.title,
        icon: s.icon,
        cols: s.cols,
        fields: orderedFields(groups.get(id) ?? groups.get(s.title) ?? []),
      }
    })
    if (orphan.length) {
      out.push({
        id: 'other',
        title: 'Other',
        fields: orderedFields(orphan),
      })
    }
    return out.filter((s) => s.fields.length > 0)
  }

  // No sections declared: single group with all visible fields.
  return [
    {
      id: 'default',
      title: '',
      fields: orderedFields(visible),
    },
  ]
})

/* ------------------------------------------------------------------ *
 * Tabs — one tab per ui.tabs[]. `fields` lists the field names shown
 * in each tab. On local navigation we validate only the visible tab;
 * on final submit we validate ALL tabs (and switch to the first
 * invalid tab if any).
 * ------------------------------------------------------------------ */

const renderedTabs = computed(() => {
  const tabs = spec.value?.ui?.tabs ?? []
  const byName = new Map(visibleFields.value.map((f) => [f.name, f]))
  return tabs.map((t, i) => ({
    id: t.id ?? `tab-${i}`,
    title: t.title,
    icon: t.icon,
    fields: orderedFields(
      (t.fields ?? [])
        .map((n) => byName.get(n))
        .filter((f): f is FieldSpec => !!f),
    ),
  }))
})

const currentTabFields = computed<FieldSpec[]>(() => {
  const tabs = renderedTabs.value
  if (!tabs.length) return visibleFields.value
  return tabs[activeTab.value]?.fields ?? []
})

/* ------------------------------------------------------------------ *
 * Steps — delegate to useSpecStepper. The stepper validates each
 * step's field subset before advancing. On finish, we run a full-form
 * validation (all visible fields) before submit.
 * ------------------------------------------------------------------ */

const stepDefs = computed<SpecStep[]>(() => {
  const steps = spec.value?.ui?.steps ?? []
  return steps.map((s) => ({
    id: s.id,
    title: s.title,
    icon: s.icon,
    fields: s.fields,
  }))
})

const stepper = useSpecStepper(
  () => stepDefs.value,
  form,
  () => asValidatedFields(visibleFields.value),
)

/** Fields in the current step (for rendering). */
const currentStepFields = computed<FieldSpec[]>(() => {
  const steps = spec.value?.ui?.steps ?? []
  if (!steps.length) return visibleFields.value
  const step = steps[stepper.currentStep.value]
  if (!step) return visibleFields.value
  const byName = new Map(visibleFields.value.map((f) => [f.name, f]))
  return orderedFields(
    (step.fields ?? [])
      .map((n) => byName.get(n))
      .filter((f): f is FieldSpec => !!f),
  )
})

/* ------------------------------------------------------------------ *
 * Validation — uses buildZodSchema from useSpecValidation (parity
 * with backend FieldValidationSpec). Falls back to the pre-change
 * behavior when no FieldValidationSpec is set (backward compat).
 * ------------------------------------------------------------------ */

function visibleFieldsForValidation(): ValidatedFieldSpec[] {
  return asValidatedFields(visibleFields.value)
}

/**
 * Validate the full form (all visible fields). On tabbed forms, also
 * validates off-tab fields. Returns true when valid; populates
 * `fieldErrors` with the first issue per field.
 */
function validateFull(): boolean {
  fieldErrors.value = {}
  const schema = buildZodSchema(visibleFieldsForValidation())
  const result = schema.safeParse(form.value)
  if (!result.success) {
    fieldErrors.value = collectZodErrors(result.error.issues)
    return false
  }
  return true
}

/**
 * Validate a subset of fields (used by tabs to validate only the
 * visible tab on local navigation). Returns true when valid; populates
 * `fieldErrors` for the subset only (off-tab errors are preserved).
 */
function validateSubset(names: string[]): boolean {
  const subset = visibleFieldsForValidation().filter((f) =>
    names.includes(f.name),
  )
  const schema = buildZodSchema(subset)
  const result = schema.safeParse(form.value)
  // Build a fresh error map: keep off-tab errors, replace subset errors.
  const nameSet = new Set(names)
  const preserved: Record<string, string> = {}
  for (const [k, v] of Object.entries(fieldErrors.value)) {
    if (!nameSet.has(k)) preserved[k] = v
  }
  if (!result.success) {
    const subsetErrors = collectZodErrors(result.error.issues)
    fieldErrors.value = { ...preserved, ...subsetErrors }
    return false
  }
  fieldErrors.value = preserved
  return true
}

/** Validate current tab (local navigation guard). */
function validateCurrentTab(): boolean {
  const names = currentTabFields.value.map((f) => f.name)
  return validateSubset(names)
}

/** Switch to the first tab that has validation errors (used on submit). */
function switchToFirstInvalidTab(): boolean {
  const tabs = renderedTabs.value
  for (let i = 0; i < tabs.length; i++) {
    const names = tabs[i].fields.map((f) => f.name)
    const subset = visibleFieldsForValidation().filter((f) =>
      names.includes(f.name),
    )
    const schema = buildZodSchema(subset)
    const result = schema.safeParse(form.value)
    if (!result.success) {
      activeTab.value = i
      fieldErrors.value = collectZodErrors(result.error.issues)
      return false
    }
  }
  return true
}

/* ------------------------------------------------------------------ *
 * Form lifecycle — defaults, record hydration, reset on mode/id change.
 * ------------------------------------------------------------------ */

const title = computed(() => {
  // Prefer the spec's displayName (singular, human-readable) → then
  // ui.singular → then a singularized version of the route resource.
  const singular =
    spec.value?.displayName ??
    spec.value?.ui?.singular ??
    singularize(props.resource)
  return props.mode === 'create' ? `New ${singular}` : `Edit ${singular}`
})

function resetForm() {
  form.value = {}
  fieldErrors.value = {}
  error.value = null
  activeTab.value = 0
  stepper.reset()
}

function applyDefaults() {
  if (!spec.value) return
  for (const field of spec.value.fields) {
    form.value[field.name] = field.default ?? undefined
  }
}

function applyRecord(record: Record<string, unknown>) {
  if (!spec.value) return
  for (const field of spec.value.fields) {
    if (record[field.name] !== undefined) {
      form.value[field.name] = record[field.name]
    }
  }
}

watch(existingRecord, (record) => {
  if (record) applyRecord(record as Record<string, unknown>)
})

onMounted(() => {
  resetForm()
  applyDefaults()
  if (existingRecord.value) {
    applyRecord(existingRecord.value as Record<string, unknown>)
  }
})

watch(() => [props.mode, props.id], () => {
  resetForm()
  applyDefaults()
  if (existingRecord.value) {
    applyRecord(existingRecord.value as Record<string, unknown>)
  }
})

/* ------------------------------------------------------------------ *
 * Submit — validates the full form, then sends only VISIBLE fields
 * (showIf-hidden fields are excluded from the payload). useSpecSubmit
 * handles file fields and JSON submission.
 * ------------------------------------------------------------------ */

/** Extract API validation errors into fieldErrors map. */
function handleApiError(e: unknown) {
  const err = e as { data?: { message?: string | string[]; errors?: Record<string, string[]> } }
  fieldErrors.value = {}
  if (err?.data?.errors) {
    for (const [field, msgs] of Object.entries(err.data.errors)) {
      fieldErrors.value[field] = Array.isArray(msgs) ? msgs[0] : String(msgs)
    }
  } else if (err?.data?.message) {
    const msg = err.data.message
    error.value = Array.isArray(msg) ? msg.join(', ') : msg
  } else {
    error.value = 'An error occurred while saving.'
  }
}

// useSpecSubmit handles file fields (uploads to /files/upload, stores path URL)
// and submits the rest as JSON. Pre-change path (no file fields) is unchanged.
const submitter = useSpecSubmit(() => props.resource)

async function submit() {
  if (!spec.value) return

  // Full-form validation across all visible fields. For tabbed forms, this
  // also validates off-tab fields and switches to the first invalid tab.
  let valid = false
  if (layoutMode.value === 'tabs') {
    valid = switchToFirstInvalidTab()
  } else {
    valid = validateFull()
  }
  if (!valid) return

  saving.value = true
  error.value = null

  try {
    // Build payload from VISIBLE fields only — showIf-hidden fields are
    // excluded so the backend never receives them.
    const payload: Record<string, unknown> = {}
    for (const field of visibleFields.value) {
      payload[field.name] = form.value[field.name]
    }

    await submitter.submit(payload, props.mode, props.id)
    router.push(`/app/${props.resource}`)
  } catch (e) {
    handleApiError(e)
  } finally {
    saving.value = false
  }
}

/** Finish handler from SpecStepper — runs full validation then submits. */
function onStepperFinish() {
  // Full-form validation across all visible fields (stepper validates per
  // step, but finish needs the whole form valid).
  if (!validateFull()) return
  submit()
}

function cancel() {
  router.push(`/app/${props.resource}`)
}

/** DaisyUI tab switch handler — validates the leaving tab. */
function onTabSwitch(newIndex: number) {
  // Validate the current tab before leaving. If invalid, stay.
  if (!validateCurrentTab()) return
  activeTab.value = newIndex
}
</script>

<template>
  <div class="container mx-auto px-4 py-6 max-w-4xl">
    <h2 class="text-xl font-semibold mb-6 text-base-content">{{ title }}</h2>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <form v-else @submit.prevent="submit">
      <!-- Global error -->
      <div v-if="error" class="alert alert-error mb-4">
        <span>{{ error }}</span>
      </div>

      <!-- ───────── STEPPER / WIZARD MODE ───────── -->
      <template v-if="layoutMode === 'steps' && stepDefs.length">
        <SpecStepper
          :steps="stepDefs"
          :stepper="stepper"
          :disabled="saving"
          @finish="onStepperFinish"
        >
          <template #default>
            <!-- Render the current step's fields in a grid. Sections inside
                 a step are not separately rendered (steps win precedence);
                 the step's fields are laid out in a single grid. -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div
                v-for="field in currentStepFields"
                :key="field.name"
                :class="colClass(field)"
              >
                <SpecFieldInput
                  v-model="form[field.name]"
                  :field="field"
                  :resource="resource"
                  :error="fieldErrors[field.name]"
                />
              </div>
            </div>
          </template>
        </SpecStepper>
      </template>

      <!-- ───────── TABS MODE ───────── -->
      <template v-else-if="layoutMode === 'tabs' && renderedTabs.length">
        <div role="tablist" class="tabs tabs-boxed mb-6">
          <button
            v-for="(tab, i) in renderedTabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab-active': i === activeTab }"
            @click="onTabSwitch(i)"
          >
            {{ tab.title }}
          </button>
        </div>

        <!-- Current tab fields -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            v-for="field in currentTabFields"
            :key="field.name"
            :class="colClass(field)"
          >
            <SpecFieldInput
              v-model="form[field.name]"
              :field="field"
              :resource="resource"
              :error="fieldErrors[field.name]"
            />
          </div>
        </div>
      </template>

      <!-- ───────── SECTIONS MODE ───────── -->
      <template v-else-if="layoutMode === 'sections' && renderedSections.length">
        <div
          v-for="section in renderedSections"
          :key="section.id"
          class="card bg-base-100 border border-base-200 rounded-lg shadow-sm mb-6"
        >
          <div class="card-body p-5 gap-4">
            <h3 v-if="section.title" class="card-title text-sm font-medium text-base-content flex items-center gap-2">
              <span v-if="section.icon" class="text-lg" aria-hidden="true">{{ section.icon }}</span>
              {{ section.title }}
            </h3>
            <div
              class="grid grid-cols-1 gap-4"
              :class="section.cols ? `md:grid-cols-${section.cols}` : 'md:grid-cols-2'"
            >
              <div
                v-for="field in section.fields"
                :key="field.name"
              >
                <SpecFieldInput
                  v-model="form[field.name]"
                  :field="field"
                  :resource="resource"
                  :error="fieldErrors[field.name]"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ───────── SIMPLE GRID MODE (backward compat) ───────── -->
      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="field in visibleFields" :key="field.name">
            <SpecFieldInput
              v-model="form[field.name]"
              :field="field"
              :resource="resource"
              :error="fieldErrors[field.name]"
            />
          </div>
        </div>
      </template>

      <!-- Actions (hidden in stepper mode — SpecStepper renders its own) -->
      <div
        v-if="layoutMode !== 'steps' || !stepDefs.length"
        class="flex items-center gap-3 mt-6"
      >
        <button
          type="submit"
          class="btn btn-primary sm:btn-wide"
          :disabled="saving"
        >
          <span v-if="saving" class="loading loading-spinner loading-xs" />
          {{ mode === 'create' ? 'Create' : 'Save' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>