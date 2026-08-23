<script setup lang="ts">
/**
 * JsonSchemaField — renderiza un campo individual de un ZodSchema recursivamente.
 * Helper interno de JsonSchemaEditor. No usar directamente.
 *
 * Zod 4 mueve `._def` a `._zod.def`. Este helper soporta ambos (v3 fallback).
 */
import { computed } from 'vue'
import type { ZodSchema } from 'zod'
import FormInput from '@base/ui-app/components/form/FormInput.vue'
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue'
import FormSelect from '@base/ui-app/components/form/FormSelect.vue'
import JsonSchemaEditor from '@base/ui-app/components/automation/JsonSchemaEditor.vue'

const props = defineProps<{
  modelValue: unknown
  schema: ZodSchema
  label?: string
  disabled?: boolean
  error?: string
}>()

const model = defineModel<unknown>({ required: true })

interface ZodDefInfo {
  type: string
  shape?: Record<string, ZodSchema>
  innerType?: ZodSchema
  element?: ZodSchema
  values?: readonly string[]
}

function inspect(schema: ZodSchema): ZodDefInfo | null {
  const def = (schema as { _zod?: { def: ZodDefInfo } })._zod?.def
    ?? (schema as { _def?: ZodDefInfo })._def
  if (!def) return null
  return def as ZodDefInfo
}

/** Desenvuelve optional/nullable hasta el tipo "real". */
const unwrapped = computed<ZodSchema>(() => {
  let s = props.schema
  for (let i = 0; i < 5; i++) {
    const d = inspect(s)
    if (!d) break
    if (d.type === 'optional' || d.type === 'nullable' || d.type === 'default') {
      if (d.innerType) s = d.innerType
      else break
    } else {
      break
    }
  }
  return s
})

const unwrappedInfo = computed<ZodDefInfo | null>(() => inspect(unwrapped.value))

const kind = computed<string>(() => unwrappedInfo.value?.type ?? 'unknown')
</script>

<template>
  <!-- z.string / z.number / fallback -->
  <FormInput
    v-if="kind === 'string' || kind === 'number' || kind === 'unknown'"
    v-model="model"
    :label="label ?? ''"
    :type="kind === 'number' ? 'number' : 'text'"
    :disabled="disabled"
    :error="error"
  />

  <!-- z.boolean -->
  <FormSwitch
    v-else-if="kind === 'boolean'"
    v-model="model"
    :label="label ?? ''"
    :disabled="disabled"
    :error="error"
  />

  <!-- z.enum -->
  <FormSelect
    v-else-if="kind === 'enum'"
    v-model="model"
    :label="label ?? ''"
    :disabled="disabled"
    :error="error"
    :options="(unwrappedInfo?.values ?? []).map((v) => ({ label: v, value: v }))"
  />

  <!-- z.object anidado: render recursivo via JsonSchemaEditor -->
  <div v-else-if="kind === 'object' && unwrappedInfo?.shape" class="form-control w-full">
    <div v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </div>
    <div class="border border-base-content/10 rounded-box p-3 bg-base-200/30 space-y-3">
      <JsonSchemaEditor
        :model-value="(model as Record<string, unknown>) ?? {}"
        :schema="unwrapped"
        :disabled="disabled"
        @update:model-value="model = $event"
      />
    </div>
  </div>

  <!-- z.array(z.object()) -->
  <div v-else-if="kind === 'array' && unwrappedInfo?.element" class="form-control w-full">
    <div v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </div>
    <div class="space-y-2">
      <div
        v-for="(_, idx) in (Array.isArray(model) ? model : [])"
        :key="idx"
        class="border border-base-content/10 rounded-box p-3 bg-base-200/30 space-y-2"
      >
        <div class="flex justify-between items-center">
          <span class="text-sm font-semibold opacity-70">#{{ idx + 1 }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs text-error"
            :disabled="disabled"
            @click="model = (model as unknown[]).filter((_, i) => i !== idx)"
          >
            {{ $t('mod.ui.automation.remove') }}
          </button>
        </div>
        <JsonSchemaEditor
          :model-value="(model as unknown[])[idx] as Record<string, unknown>"
          :schema="unwrappedInfo.element"
          :disabled="disabled"
          @update:model-value="model = (model as unknown[]).map((v, i) => (i === idx ? $event : v))"
        />
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline w-full"
        :disabled="disabled"
        @click="model = [...(Array.isArray(model) ? model : []), {}]"
      >
        {{ $t('mod.ui.automation.addRow') }}
      </button>
    </div>
  </div>

  <!-- Tipo no soportado: fallback texto plano (Q-008) -->
  <FormInput
    v-else
    v-model="model"
    :label="label ?? ''"
    :disabled="disabled"
    :error="error ?? $t('mod.ui.automation.unsupportedType')"
  />
</template>