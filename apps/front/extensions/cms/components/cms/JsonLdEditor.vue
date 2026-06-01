<script setup lang="ts">
import { JSON_LD_SCHEMAS, getSchemasByCategory, type JsonLdField, type JsonLdSchema } from '@cms/utils/json-ld-schemas';

const props = defineProps<{
  modelValue?: string | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const selectedType = ref('');
const formData = ref<Record<string, any>>({});
const showPreview = ref(false);

const categories = computed(() => getSchemasByCategory());

const currentSchema = computed(() =>
  JSON_LD_SCHEMAS.find((s) => s.type === selectedType.value),
);

watch(selectedType, () => {
  formData.value = {};
});

// Initialize from existing JSON-LD
watch(() => props.modelValue, (val) => {
  if (val) {
    try {
      const parsed = JSON.parse(val);
      if (parsed['@type']) {
        selectedType.value = parsed['@type'];
        formData.value = parsed;
      }
    } catch { /* invalid JSON, ignore */ }
  }
}, { immediate: true });

const generatedJsonLd = computed(() => {
  if (!selectedType.value || !currentSchema.value) return '';
  const data = buildOutput(formData.value, currentSchema.value);
  return JSON.stringify({ '@context': 'https://schema.org', '@type': selectedType.value, ...data }, null, 2);
});

function buildOutput(data: Record<string, any>, schema: JsonLdSchema): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of schema.fields) {
    const val = data[field.key];
    if (val === undefined || val === '' || val === null) continue;
    if (field.type === 'object' && field.children) {
      out[field.key] = buildNested(val, field.children);
    } else if (field.type === 'array' && field.children) {
      out[field.key] = buildArray(val, field.children);
    } else {
      out[field.key] = val;
    }
  }
  return out;
}

function buildNested(data: Record<string, any>, fields: JsonLdField[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of fields) {
    const val = data[field.key];
    if (val === undefined || val === '' || val === null) continue;
    if (field.type === 'object' && field.children) {
      out[field.key] = buildNested(val, field.children);
    } else if (field.type === 'array' && field.children) {
      out[field.key] = buildArray(val, field.children);
    } else {
      out[field.key] = val;
    }
  }
  return out;
}

function buildArray(data: any[], fields: JsonLdField[]): any[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => buildNested(item, fields));
}

function getValue(path: string): any {
  return formData.value[path];
}

function setValue(path: string, value: any) {
  formData.value = { ...formData.value, [path]: value };
  emitUpdate();
}

function addArrayItem(fieldKey: string, schema: JsonLdField) {
  const current = (formData.value[fieldKey] as any[]) || [];
  const item: Record<string, any> = {};
  if (schema.children) {
    for (const child of schema.children) {
      if (child.type === 'object') item[child.key] = {};
      else item[child.key] = '';
    }
  }
  formData.value = { ...formData.value, [fieldKey]: [...current, item] };
  emitUpdate();
}

function removeArrayItem(fieldKey: string, index: number) {
  const current = (formData.value[fieldKey] as any[]) || [];
  formData.value = { ...formData.value, [fieldKey]: current.filter((_, i) => i !== index) };
  emitUpdate();
}

function setArrayItemValue(fieldKey: string, itemIndex: number, childKey: string, value: any) {
  const current = (formData.value[fieldKey] as any[]) || [];
  const updated = [...current];
  updated[itemIndex] = { ...updated[itemIndex], [childKey]: value };
  formData.value = { ...formData.value, [fieldKey]: updated };
  emitUpdate();
}

function setNestedValue(parentKey: string, childKey: string, value: any) {
  const current = formData.value[parentKey] || {};
  formData.value = { ...formData.value, [parentKey]: { ...current, [childKey]: value } };
  emitUpdate();
}

function emitUpdate() {
  if (selectedType.value) {
    const data = buildOutput(formData.value, currentSchema.value!);
    const json = JSON.stringify({ '@context': 'https://schema.org', '@type': selectedType.value, ...data }, null, 2);
    emit('update:modelValue', json);
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Type Selector -->
    <div class="form-control">
      <label class="label">
        <span class="label-text font-medium">Tipo de Schema</span>
      </label>
      <select v-model="selectedType" class="select select-bordered w-full">
        <option value="" disabled>Seleccionar tipo...</option>
        <optgroup v-for="(schemas, cat) in categories" :key="cat" :label="cat">
          <option v-for="schema in schemas" :key="schema.type" :value="schema.type">
            {{ schema.label }}
          </option>
        </optgroup>
      </select>
      <label v-if="currentSchema" class="label">
        <span class="label-text-alt text-base-content/60">{{ currentSchema.description }}</span>
      </label>
    </div>

    <!-- Dynamic Form Fields -->
    <div v-if="currentSchema" class="space-y-3">
      <div v-for="field in currentSchema.fields" :key="field.key" class="form-control">
        <label class="label py-1">
          <span class="label-text">
            {{ field.label }}
            <span v-if="field.required" class="text-error ml-1">*</span>
          </span>
          <span class="label-text-alt text-base-content/50">{{ field.type }}</span>
        </label>

        <!-- Text / URL / Date / Number -->
        <template v-if="field.type === 'text' || field.type === 'url' || field.type === 'date' || field.type === 'number'">
          <input
            :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'"
            :placeholder="field.placeholder"
            :value="getValue(field.key) || ''"
            class="input input-bordered input-sm w-full"
            @input="setValue(field.key, ($event.target as HTMLInputElement).value)"
          >
        </template>

        <!-- Textarea -->
        <template v-else-if="field.type === 'textarea'">
          <textarea
            :placeholder="field.placeholder"
            :value="getValue(field.key) || ''"
            class="textarea textarea-bordered textarea-sm w-full"
            rows="2"
            @input="setValue(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
        </template>

        <!-- Select -->
        <template v-else-if="field.type === 'select' && field.options">
          <select
            :value="getValue(field.key) || ''"
            class="select select-bordered select-sm w-full"
            @change="setValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">--</option>
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </template>

        <!-- Nested Object -->
        <template v-else-if="field.type === 'object' && field.children">
          <div class="pl-4 border-l-2 border-base-300 space-y-2 bg-base-200/50 rounded p-3">
            <div v-for="child in field.children" :key="child.key" class="form-control">
              <label class="label py-1">
                <span class="label-text text-sm">{{ child.label }}<span v-if="child.required" class="text-error">*</span></span>
              </label>

              <template v-if="child.type === 'select' && child.options">
                <select
                  :value="getValue(field.key)?.[child.key] || ''"
                  class="select select-bordered select-sm w-full"
                  @change="setNestedValue(field.key, child.key, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">--</option>
                  <option v-for="opt in child.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </template>
              <template v-else-if="child.type === 'textarea'">
                <textarea
                  :value="getValue(field.key)?.[child.key] || ''"
                  class="textarea textarea-bordered textarea-sm w-full"
                  rows="2"
                  @input="setNestedValue(field.key, child.key, ($event.target as HTMLTextAreaElement).value)"
                />
              </template>
              <template v-else>
                <input
                  :type="child.type === 'number' ? 'number' : child.type === 'url' ? 'url' : 'text'"
                  :value="getValue(field.key)?.[child.key] || ''"
                  class="input input-bordered input-sm w-full"
                  @input="setNestedValue(field.key, child.key, ($event.target as HTMLInputElement).value)"
                >
              </template>
            </div>
          </div>
        </template>

        <!-- Array -->
        <template v-else-if="field.type === 'array' && field.children">
          <div class="space-y-2">
            <div
              v-for="(item, idx) in (getValue(field.key) || [])"
              :key="idx"
              class="pl-4 border-l-2 border-base-300 bg-base-200/50 rounded p-3 relative"
            >
              <button
                type="button"
                class="btn btn-xs btn-error btn-circle absolute -top-2 -right-2"
                @click="removeArrayItem(field.key, idx)"
              >x</button>
              <div class="space-y-2">
                <div v-for="child in field.children!" :key="child.key" class="form-control">
                  <label class="label py-1">
                    <span class="label-text text-sm">{{ child.label }}<span v-if="child.required" class="text-error">*</span></span>
                  </label>
                  <template v-if="child.type === 'textarea'">
                    <textarea
                      :value="item[child.key] || ''"
                      class="textarea textarea-bordered textarea-sm w-full"
                      rows="2"
                      @input="setArrayItemValue(field.key, idx, child.key, ($event.target as HTMLTextAreaElement).value)"
                    />
                  </template>
                  <template v-else-if="child.type === 'select' && child.options">
                    <select
                      :value="item[child.key] || ''"
                      class="select select-bordered select-sm w-full"
                      @change="setArrayItemValue(field.key, idx, child.key, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">--</option>
                      <option v-for="opt in child.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                  </template>
                  <template v-else>
                    <input
                      :type="child.type === 'number' ? 'number' : child.type === 'url' ? 'url' : 'text'"
                      :value="item[child.key] || ''"
                      class="input input-bordered input-sm w-full"
                      @input="setArrayItemValue(field.key, idx, child.key, ($event.target as HTMLInputElement).value)"
                    >
                  </template>
                </div>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline w-full" @click="addArrayItem(field.key, field)">
              + Añadir {{ field.label }}
            </button>
          </div>
        </template>
      </div>

      <!-- Preview Toggle -->
      <div class="collapse collapse-arrow bg-base-200">
        <input v-model="showPreview" type="checkbox" >
        <div class="collapse-title text-sm font-medium">Vista previa JSON-LD</div>
        <div class="collapse-content">
          <pre class="text-xs bg-neutral text-neutral-content p-3 rounded-lg overflow-x-auto max-h-64"><code>{{ generatedJsonLd || 'Selecciona un tipo y completa los campos...' }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>
