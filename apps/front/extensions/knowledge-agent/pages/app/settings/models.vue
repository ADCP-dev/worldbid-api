<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { toast } from 'vue-sonner';
import { Cpu, Database, Plus } from 'lucide-vue-next';
import { useAuthStore } from '@base/auth/stores/auth.store';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
import KaFormModal from '@ka/components/KaFormModal.vue';
import { KA_SETTINGS_SECTIONS, type KaConfigSection } from '@ka/composables/useKaSettingsNav';
import { useModelProviders } from '@ka/composables/useAgentConfig';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const sections = computed<KaConfigSection[]>(() => KA_SETTINGS_SECTIONS(t));

const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const { getProviders, createProvider, getModels, createModel } =
  useModelProviders();
const queryClient = useQueryClient();

const { data: providers, isLoading: loadingProviders } = useQuery({
  queryKey: ['ka-providers'],
  queryFn: getProviders,
  enabled: isAdmin,
});

const { data: models, isLoading: loadingModels } = useQuery({
  queryKey: ['ka-models'],
  queryFn: () => getModels(),
  enabled: isAdmin,
});

const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'ollama-cloud', label: 'Ollama Cloud' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
];

/** Pre-fill baseUrl by provider so the user doesn't look it up. */
function defaultBaseUrl(provider: string): string {
  switch (provider) {
    case 'ollama': return 'http://127.0.0.1:11434';
    case 'ollama-cloud': return 'https://api.ovh.net/ollama';
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'openai': return 'https://api.openai.com/v1';
    default: return '';
  }
}
function defaultApiKeyRef(provider: string): string {
  switch (provider) {
    case 'ollama': return '';
    case 'ollama-cloud': return 'OLLAMA_CLOUD_API_KEY';
    case 'openrouter': return 'OPENROUTER_API_KEY';
    case 'openai': return 'OPENAI_API_KEY';
    default: return '';
  }
}

/* ── Provider modal ────────────────────────────────────────────────────── */
const providerModalOpen = ref(false);
const providerForm = ref({
  name: '',
  provider: 'ollama',
  apiKeyRef: '',
  baseUrl: '',
});

function openProviderModal(): void {
  providerForm.value = { name: '', provider: 'ollama', apiKeyRef: '', baseUrl: '' };
  providerModalOpen.value = true;
}

// Auto-fill baseUrl + apiKeyRef when provider type changes.
watch(() => providerForm.value.provider, (p) => {
  providerForm.value.baseUrl = defaultBaseUrl(p);
  providerForm.value.apiKeyRef = defaultApiKeyRef(p);
});

const createProviderMutation = useMutation({
  mutationFn: () =>
    createProvider({
      name: providerForm.value.name,
      provider: providerForm.value.provider,
      apiKeyRef: providerForm.value.apiKeyRef || undefined,
      baseUrl: providerForm.value.baseUrl || undefined,
      enabled: true,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-providers'] });
    toast.success(t('ext.ka.settings.providerSaved', 'Provider saved'));
    providerModalOpen.value = false;
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

/* ── Model modal (cascading provider → model) ──────────────────────────── */
const modelModalOpen = ref(false);
const modelForm = ref({
  providerId: '',
  modelId: '',
  displayName: '',
  contextWindow: 128000,
});

const providerOptions = computed(() =>
  (providers.value ?? []).map((p) => ({ label: p.name, value: p.id })),
);

const modelProviderSelected = computed(() =>
  providers.value?.find((p) => p.id === modelForm.value.providerId),
);

function openModelModal(): void {
  modelForm.value = { providerId: '', modelId: '', displayName: '', contextWindow: 128000 };
  modelModalOpen.value = true;
}

// Reset modelId/displayName when provider changes — they must match the provider.
watch(() => modelForm.value.providerId, () => {
  modelForm.value.modelId = '';
  modelForm.value.displayName = '';
});

const createModelMutation = useMutation({
  mutationFn: () =>
    createModel({
      providerId: modelForm.value.providerId,
      modelId: modelForm.value.modelId,
      displayName: modelForm.value.displayName,
      contextWindow: Number(modelForm.value.contextWindow),
      active: true,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-models'] });
    toast.success(t('ext.ka.settings.modelSaved', 'Model saved'));
    modelModalOpen.value = false;
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

const providerName = (id: string) =>
  providers.value?.find((p) => p.id === id)?.name ?? id;

/* ── Submit handlers with basic validation ─────────────────────────────── */
function submitProvider(): void {
  if (!providerForm.value.name.trim()) return;
  createProviderMutation.mutate();
}
function submitModel(): void {
  if (!modelForm.value.providerId || !modelForm.value.modelId.trim() || !modelForm.value.displayName.trim()) return;
  createModelMutation.mutate();
}
</script>

<template>
  <ConfigLayout
    :sections="sections"
    active-key="models"
    :title="t('ext.ka.nav.config')"
  >
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.models') }}</h1>
        <p class="text-base-content/60 text-sm">
          {{ t('ext.ka.settings.modelsDescription') }}
        </p>
      </header>

      <div v-if="!isAdmin" class="alert alert-warning">
        <span>{{ t('ext.ka.settings.adminRequired') }}</span>
      </div>

      <template v-else>
        <!-- Providers -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold inline-flex items-center gap-2">
              <Database :size="18" class="text-base-content/60" />
              {{ t('ext.ka.settings.providers') }}
            </h2>
            <button class="btn btn-primary btn-sm gap-1.5" @click="openProviderModal">
              <Plus :size="14" />
              {{ t('ext.ka.settings.newProvider') }}
            </button>
          </div>
          <div v-if="loadingProviders" class="flex justify-center py-4">
            <span class="loading loading-spinner loading-md" />
          </div>
          <div v-else-if="!providers?.length" class="text-base-content/50 text-sm">
            {{ t('ext.ka.settings.noProviders') }}
          </div>
          <div v-else class="grid gap-3">
            <article
              v-for="p in providers"
              :key="p.id"
              class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-2"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold truncate">{{ p.name }}</h3>
                <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                  <span class="badge badge-sm badge-outline">{{ p.provider }}</span>
                  <code v-if="p.baseUrl" class="bg-base-200 px-1.5 py-0.5 rounded text-[10px]">{{ p.baseUrl }}</code>
                  <span v-else class="italic">—</span>
                </div>
              </div>
              <span
                :class="['badge badge-sm shrink-0', p.enabled ? 'badge-success' : 'badge-ghost']"
              >
                {{ p.enabled ? t('ext.ka.settings.yes') : t('ext.ka.settings.no') }}
              </span>
            </article>
          </div>
        </section>

        <!-- Models -->
        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold inline-flex items-center gap-2">
              <Cpu :size="18" class="text-base-content/60" />
              {{ t('ext.ka.settings.models') }}
            </h2>
            <button
              class="btn btn-primary btn-sm gap-1.5"
              :disabled="!providers?.length"
              @click="openModelModal"
            >
              <Plus :size="14" />
              {{ t('ext.ka.settings.newModel') }}
            </button>
          </div>
          <div v-if="loadingModels" class="flex justify-center py-4">
            <span class="loading loading-spinner loading-md" />
          </div>
          <div v-else-if="!models?.length" class="text-base-content/50 text-sm">
            {{ t('ext.ka.settings.noModels') }}
          </div>
          <div v-else class="grid gap-3">
            <article
              v-for="m in models"
              :key="m.id"
              class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-2"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold truncate">{{ m.displayName }}</h3>
                <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                  <code class="bg-base-200 px-1.5 py-0.5 rounded">{{ m.modelId }}</code>
                  <span class="badge badge-sm badge-outline">{{ providerName(m.providerId) }}</span>
                  <span>{{ m.contextWindow.toLocaleString() }}</span>
                </div>
              </div>
              <span
                :class="['badge badge-sm shrink-0', m.active ? 'badge-success' : 'badge-ghost']"
              >
                {{ m.active ? t('ext.ka.settings.yes') : t('ext.ka.settings.no') }}
              </span>
            </article>
          </div>
        </section>
      </template>
    </div>

    <!-- Provider modal -->
    <KaFormModal
      v-model="providerModalOpen"
      :title="t('ext.ka.settings.newProvider')"
      :loading="createProviderMutation.isPending.value"
      :submit-label="t('ext.ka.settings.addProvider')"
      @submit="submitProvider"
    >
      <FormInput
        v-model="providerForm.name"
        :label="t('ext.ka.settings.fieldName')"
        placeholder="Ollama Cloud"
        required
      />
      <FormSelect
        v-model="providerForm.provider"
        :label="t('ext.ka.settings.fieldProvider')"
        :options="PROVIDER_OPTIONS"
      />
      <FormInput
        v-model="providerForm.baseUrl"
        :label="t('ext.ka.settings.fieldBaseUrl')"
        :placeholder="defaultBaseUrl(providerForm.provider) || 'https://…'"
        :description="t('ext.ka.settings.baseUrlHint', 'Default endpoint for the selected provider; override if self-hosted')"
      />
      <FormInput
        v-model="providerForm.apiKeyRef"
        :label="t('ext.ka.settings.fieldApiKeyRef')"
        :placeholder="defaultApiKeyRef(providerForm.provider) || 'e.g. OLLAMA_CLOUD_API_KEY'"
        :description="t('ext.ka.settings.apiKeyRefDescription')"
      />
    </KaFormModal>

    <!-- Model modal (cascading) -->
    <KaFormModal
      v-model="modelModalOpen"
      :title="t('ext.ka.settings.newModel')"
      :loading="createModelMutation.isPending.value"
      :submit-label="t('ext.ka.settings.addModel')"
      @submit="submitModel"
    >
      <FormSelect
        v-model="modelForm.providerId"
        :label="t('ext.ka.settings.fieldProvider')"
        :placeholder="t('ext.ka.settings.selectProvider')"
        :options="providerOptions"
        required
      />
      <p v-if="!modelForm.providerId" class="text-xs text-base-content/50 italic">
        {{ t('ext.ka.settings.pickProviderFirst', 'Pick a provider first — model fields will unlock after that.') }}
      </p>
      <div v-if="modelProviderSelected" class="alert alert-soft text-xs">
        <span>
          {{ t('ext.ka.settings.usedProvider', 'Model will be registered under') }}:
          <strong>{{ modelProviderSelected.name }}</strong>
          <code class="ml-1 bg-base-200 px-1 py-0.5 rounded">{{ modelProviderSelected.provider }}</code>
        </span>
      </div>
      <FormInput
        v-model="modelForm.modelId"
        :label="t('ext.ka.settings.fieldModelId')"
        placeholder="e.g. z-ai/glm-5.2"
        :disabled="!modelForm.providerId"
        required
      />
      <FormInput
        v-model="modelForm.displayName"
        :label="t('ext.ka.settings.fieldDisplayName')"
        placeholder="GLM 5.2"
        :disabled="!modelForm.providerId"
        required
      />
      <FormInput
        v-model="modelForm.contextWindow"
        :label="t('ext.ka.settings.fieldContextWindow')"
        type="number"
        :disabled="!modelForm.providerId"
      />
    </KaFormModal>
  </ConfigLayout>
</template>
