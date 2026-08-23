<script setup lang="ts">
/**
 * Demo page — Automation components.
 * Ruta: /app/components/automation
 */
import { ref } from 'vue'
import { z } from 'zod'
import { Rocket, Briefcase, Building2 } from 'lucide-vue-next'
import BaseAutomationRadioCards from '@base/ui-app/components/automation/RadioCards.vue'
import BaseAutomationJsonSchemaEditor from '@base/ui-app/components/automation/JsonSchemaEditor.vue'
import BaseAutomationFieldRelation from '@base/ui-app/components/automation/FieldRelation.vue'
import ToggleGroup from '@base/ui-app/components/form/ToggleGroup.vue'
import KeyValueEditor from '@base/ui-app/components/form/KeyValueEditor.vue'

definePageMeta({
  title: 'Automation Components',
  layout: 'default',
})

// --- RadioCards ---
const plan = ref('pro')
const planOptions = [
  { value: 'free', label: 'Gratis', icon: Rocket, description: 'Funciones básicas para empezar' },
  { value: 'pro', label: 'Pro', icon: Briefcase, description: 'Funciones avanzadas para equipos' },
  { value: 'enterprise', label: 'Empresa', icon: Building2, description: 'Soluciones a medida y soporte' },
]

// --- ToggleGroup (multi) ---
const platforms = ref<string[]>(['twitter'])
const platformOptions = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
]

// --- ToggleGroup (single) ---
const channel = ref('email')
const channelOptions = [
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push' },
  { value: 'sms', label: 'SMS' },
]

// --- JsonSchemaEditor ---
const automationSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  retries: z.optional(z.number()),
  config: z.object({
    webhook: z.string(),
    timeout: z.number(),
  }),
  recipients: z.array(z.object({
    email: z.string(),
    role: z.enum(['admin', 'viewer']),
  })),
})
const automationConfig = ref<Record<string, unknown>>({})

// --- FieldRelation (simulado) ---
const clientId = ref<string>('')
const clientOptions = [
  { label: 'Acme Corp', value: 'acme' },
  { label: 'Globex', value: 'globex' },
  { label: 'Initech', value: 'initech' },
]
const selectedClient = ref<unknown>(null)
function onClientSelect(item: unknown) {
  selectedClient.value = item
}
// Nota: endpoint real no existe en dev; FieldRelation hace toast en error (FR-133).

// --- KeyValueEditor (string) ---
const metadata = ref<Record<string, unknown>>({ source: 'manual', campaign: 'launch-2026' })

// --- KeyValueEditor (boolean) ---
const featureFlags = ref<Record<string, unknown>>({ beta: true, darkMode: false })

const codeRadioCards = `<BaseAutomationRadioCards
  v-model="plan"
  :options="planOptions"
  :columns="3"
  label="Plan"
/>`
const codeToggleGroup = `<ToggleGroup
  v-model="platforms"
  :options="platformOptions"
  multiple
  label="Plataformas"
/>`
const codeJsonSchemaEditor = `<BaseAutomationJsonSchemaEditor
  v-model="config"
  :schema="automationSchema"
  label="Configuración"
/>`
const codeFieldRelation = `<BaseAutomationFieldRelation
  v-model="clientId"
  label="Cliente"
  endpoint="/clients"
  :options="clientOptions"
  @select="onClientSelect"
/>`
const codeKeyValueEditor = `<KeyValueEditor
  v-model="metadata"
  label="Metadata"
  value-type="string"
/>`
</script>

<template>
  <div class="container mx-auto py-10 px-4">
    <div class="max-w-3xl mx-auto flex flex-col gap-10">
      <!-- Header -->
      <div>
        <h1 class="text-3xl font-bold tracking-tight mb-2">
          {{ $t('mod.ui.automation.title') }}
        </h1>
        <p class="text-base-content/60">{{ $t('mod.ui.automation.subtitle') }}</p>
      </div>

      <!-- Zod subset note (Q-008) -->
      <div class="alert alert-info">
        <span class="text-sm">{{ $t('mod.ui.automation.zodSubsetNote') }}</span>
      </div>

      <!-- RadioCards -->
      <section class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8 space-y-4">
          <h2 class="text-xl font-semibold">{{ $t('mod.ui.automation.radioCards.title') }}</h2>
          <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.radioCards.description') }}</p>
          <BaseAutomationRadioCards
            v-model="plan"
            :options="planOptions"
            :columns="3"
            label="Plan"
          />
          <div class="text-sm opacity-70">
            {{ $t('mod.ui.automation.radioCards.selected') }}: <code class="font-mono">{{ plan }}</code>
          </div>
          <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto"><code>{{ codeRadioCards }}</code></pre>
        </div>
      </section>

      <!-- ToggleGroup multi + single -->
      <section class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8 space-y-6">
          <h2 class="text-xl font-semibold">{{ $t('mod.ui.automation.toggleGroup.title') }}</h2>

          <div class="space-y-2">
            <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.toggleGroup.multiDesc') }}</p>
            <ToggleGroup
              v-model="platforms"
              :options="platformOptions"
              :multiple="true"
              label="Plataformas"
            />
            <div class="text-sm opacity-70">v-model: <code class="font-mono">{{ JSON.stringify(platforms) }}</code></div>
          </div>

          <div class="space-y-2">
            <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.toggleGroup.singleDesc') }}</p>
            <ToggleGroup
              v-model="channel"
              :options="channelOptions"
              :multiple="false"
              label="Canal preferido"
            />
            <div class="text-sm opacity-70">v-model: <code class="font-mono">{{ channel }}</code></div>
          </div>

          <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto"><code>{{ codeToggleGroup }}</code></pre>
        </div>
      </section>

      <!-- JsonSchemaEditor -->
      <section class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8 space-y-4">
          <h2 class="text-xl font-semibold">{{ $t('mod.ui.automation.jsonSchemaEditor.title') }}</h2>
          <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.jsonSchemaEditor.description') }}</p>
          <BaseAutomationJsonSchemaEditor
            v-model="automationConfig"
            :schema="automationSchema"
            label="Configuración"
          />
          <div class="text-sm opacity-70">v-model: <code class="font-mono text-xs">{{ JSON.stringify(automationConfig) }}</code></div>
          <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto"><code>{{ codeJsonSchemaEditor }}</code></pre>
        </div>
      </section>

      <!-- FieldRelation -->
      <section class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8 space-y-4">
          <h2 class="text-xl font-semibold">{{ $t('mod.ui.automation.fieldRelation.title') }}</h2>
          <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.fieldRelation.description') }}</p>
          <BaseAutomationFieldRelation
            v-model="clientId"
            label="Cliente"
            endpoint="/clients"
            :options="clientOptions"
            :placeholder="$t('mod.ui.automation.fieldRelation.placeholder')"
            @select="onClientSelect"
          />
          <div class="text-sm opacity-70">
            {{ $t('mod.ui.automation.fieldRelation.selectedItem') }}:
            <code class="font-mono text-xs">{{ JSON.stringify(selectedClient) }}</code>
          </div>
          <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto"><code>{{ codeFieldRelation }}</code></pre>
        </div>
      </section>

      <!-- KeyValueEditor string + boolean -->
      <section class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8 space-y-6">
          <h2 class="text-xl font-semibold">{{ $t('mod.ui.automation.keyValueEditor.title') }}</h2>

          <div class="space-y-2">
            <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.keyValueEditor.stringDesc') }}</p>
            <KeyValueEditor
              v-model="metadata"
              label="Metadata"
              value-type="string"
            />
            <div class="text-sm opacity-70">v-model: <code class="font-mono text-xs">{{ JSON.stringify(metadata) }}</code></div>
          </div>

          <div class="space-y-2">
            <p class="text-sm text-base-content/60">{{ $t('mod.ui.automation.keyValueEditor.booleanDesc') }}</p>
            <KeyValueEditor
              v-model="featureFlags"
              label="Feature flags"
              value-type="boolean"
            />
            <div class="text-sm opacity-70">v-model: <code class="font-mono text-xs">{{ JSON.stringify(featureFlags) }}</code></div>
          </div>

          <pre class="bg-base-200 p-3 rounded-box text-xs overflow-x-auto"><code>{{ codeKeyValueEditor }}</code></pre>
        </div>
      </section>
    </div>
  </div>
</template>