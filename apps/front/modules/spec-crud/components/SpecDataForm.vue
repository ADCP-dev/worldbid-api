<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import type { FieldSpec } from '../composables/useSpecResource'
import SpecFieldInput from './SpecFieldInput.vue'

const props = defineProps<{
  resource: string
  mode: 'create' | 'edit'
  id?: string | number
}>()

const specCrud = useSpecResource()
const router = useRouter()

const { useFindOneQuery, useCreateMutation, useUpdateMutation } = specCrud
const spec = specCrud.getResource(props.resource)

const saving = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const form = ref<Record<string, unknown>>({})

const { data: existingRecord, isLoading: loading } = useFindOneQuery(
  () => props.resource,
  () => props.id,
)

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

function resetForm() {
  form.value = {}
  fieldErrors.value = {}
  error.value = null
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

function buildSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of formFields.value) {
    if (field.readOnly) continue
    let schema: z.ZodTypeAny = z.any()
    switch (field.type) {
      case 'integer':
        schema = z.coerce.number().int()
        break
      case 'decimal':
      case 'float':
      case 'number':
        schema = z.coerce.number()
        break
      case 'boolean':
        schema = z.boolean()
        break
      case 'date':
      case 'datetime':
        schema = z.string()
        break
      case 'enum':
        if (field.enum?.length) {
          schema = z.enum(field.enum as [string, ...string[]])
        } else {
          schema = z.string()
        }
        break
      default:
        schema = z.string()
    }
    if (!field.required) {
      schema = schema.optional()
    } else if (field.type !== 'boolean' && field.type !== 'integer' && field.type !== 'decimal' && field.type !== 'float' && field.type !== 'number') {
      schema = schema.refine((v) => v !== '' && v !== undefined && v !== null, { message: 'Required' })
    }
    shape[field.name] = schema
  }
  return z.object(shape)
}

function validate(): boolean {
  fieldErrors.value = {}
  const schema = buildSchema()
  const result = schema.safeParse(form.value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string
      if (!fieldErrors.value[key]) fieldErrors.value[key] = issue.message
    }
    return false
  }
  return true
}

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

const createMutation = useCreateMutation(() => props.resource)
const updateMutation = useUpdateMutation(() => props.resource)

async function submit() {
  if (!spec.value || !validate()) return
  saving.value = true
  error.value = null

  try {
    const payload: Record<string, unknown> = {}
    for (const field of formFields.value) {
      payload[field.name] = form.value[field.name]
    }

    if (props.mode === 'create') {
      await createMutation.mutateAsync(payload)
      toast.success('Created successfully')
    } else if (props.mode === 'edit' && props.id) {
      await updateMutation.mutateAsync({ id: props.id, body: payload })
      toast.success('Updated successfully')
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
  <div class="container mx-auto px-4 py-6">
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

      <!-- Fields -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="field in formFields" :key="field.name">
          <SpecFieldInput
            v-model="form[field.name]"
            :field="field"
            :resource="resource"
            :error="fieldErrors[field.name]"
          />
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
