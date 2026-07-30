<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'

const props = defineProps<{
  /** Resource name */
  resource: string
  /** 'create' or 'edit' */
  mode: 'create' | 'edit'
  /** Record id (edit mode only) */
  id?: string | number
}>()

const specCrud = useSpecResource()
const router = useRouter()

const spec = computed(() => specCrud.getResource(props.resource))
const primaryKey = computed(() => spec.value?.primaryKey ?? 'id')

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
/** Field-level validation errors keyed by field name */
const fieldErrors = ref<Record<string, string>>({})

/** Reactive form state */
const form = reactive<Record<string, unknown>>({})

/** Fields to render in the form. */
const formFields = computed<FieldSpec[]>(() => {
  if (!spec.value) return []
  const names = spec.value.ui?.formFields
  if (names && names.length) {
    return names
      .map((n) => spec.value!.fields.find((f) => f.name === n))
      .filter((f): f is FieldSpec => !!f)
  }
  return spec.value.fields.filter((f) => !f.readOnly || props.mode === 'edit')
})

const title = computed(() => {
  const singular = spec.value?.ui?.singular ?? props.resource
  return props.mode === 'create' ? `New ${singular}` : `Edit ${singular}`
})

/** Initialise form with defaults (create) or fetched record (edit). */
async function initForm() {
  // Reset
  Object.keys(form).forEach((k) => delete form[k])
  fieldErrors.value = {}
  error.value = null

  if (!spec.value) return

  // Set defaults for all fields
  for (const field of spec.value.fields) {
    form[field.name] = field.default ?? undefined
  }

  if (props.mode === 'edit' && props.id) {
    loading.value = true
    try {
      const record = await specCrud.findOne(props.resource, props.id)
      for (const field of spec.value.fields) {
        if (record && record[field.name] !== undefined) {
          form[field.name] = record[field.name]
        }
      }
    } catch (e) {
      error.value = (e as Error).message || 'Failed to load record'
    } finally {
      loading.value = false
    }
  }
}

onMounted(async () => {
  await specCrud.ensureSpec()
  await initForm()
})

// Re-init when id or mode changes (e.g. navigating between edit records)
watch(() => [props.mode, props.id], () => initForm())

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

async function submit() {
  if (!spec.value) return
  saving.value = true
  error.value = null
  fieldErrors.value = {}

  try {
    // Build payload — only form fields
    const payload: Record<string, unknown> = {}
    for (const field of formFields.value) {
      payload[field.name] = form[field.name]
    }

    if (props.mode === 'create') {
      await specCrud.create(props.resource, payload)
    } else if (props.mode === 'edit' && props.id) {
      await specCrud.update(props.resource, props.id, payload)
    }

    router.push(`/app/${props.resource}`)
  } catch (e) {
    handleApiError(e)
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push(`/app/${props.resource}`)
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <h2 class="text-xl font-semibold mb-6">{{ title }}</h2>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <form v-else @submit.prevent="submit">
      <!-- Global error -->
      <div v-if="error" class="alert alert-error mb-4">
        <span>{{ error }}</span>
      </div>

      <!-- Fields -->
      <div class="flex flex-col gap-4">
        <div v-for="field in formFields" :key="field.name">
          <SpecFieldInput
            v-model="form[field.name]"
            :field="field"
            :resource="resource"
          />
          <p v-if="fieldErrors[field.name]" class="text-error text-sm mt-1">
            {{ fieldErrors[field.name] }}
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 mt-6">
        <button
          type="submit"
          class="btn btn-primary"
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