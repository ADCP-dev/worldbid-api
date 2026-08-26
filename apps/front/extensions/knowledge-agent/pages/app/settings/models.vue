<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@base/auth/stores/auth.store';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
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

const providerForm = ref({
  name: '',
  provider: 'ollama',
  apiKeyRef: '',
  baseUrl: '',
});

const modelForm = ref({
  providerId: '',
  modelId: '',
  displayName: '',
  contextWindow: 128000,
});

const providerOptions = computed(() =>
  (providers.value ?? []).map((p) => ({ label: p.name, value: p.id })),
);

const providerName = (id: string) =>
  providers.value?.find((p) => p.id === id)?.name ?? id;

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
    providerForm.value = { name: '', provider: 'ollama', apiKeyRef: '', baseUrl: '' };
  },
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
    modelForm.value = { providerId: '', modelId: '', displayName: '', contextWindow: 128000 };
  },
});
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
        <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
          <h2 class="text-lg font-semibold">{{ t('ext.ka.settings.newProvider') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              :placeholder="providerForm.provider === 'ollama-cloud' ? 'https://api.ovh.net/ollama' : 'https://openrouter.ai/api/v1'"
            />
            <FormInput
              v-model="providerForm.apiKeyRef"
              :label="t('ext.ka.settings.fieldApiKeyRef')"
              placeholder="e.g. OLLAMA_CLOUD_API_KEY"
              :description="t('ext.ka.settings.apiKeyRefDescription')"
            />
          </div>
          <button
            class="btn btn-primary"
            :disabled="createProviderMutation.isPending.value || !providerForm.name"
            @click="createProviderMutation.mutate()"
          >
            {{ createProviderMutation.isPending.value ? t('ext.ka.settings.saving') : t('ext.ka.settings.addProvider') }}
          </button>
          <p v-if="createProviderMutation.isError.value" class="text-error text-sm">
            {{ createProviderMutation.error?.message }}
          </p>
        </section>

        <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
          <h2 class="text-lg font-semibold">{{ t('ext.ka.settings.newModel') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormSelect
              v-model="modelForm.providerId"
              :label="t('ext.ka.settings.fieldProvider')"
              :placeholder="t('ext.ka.settings.selectProvider')"
              :options="providerOptions"
              required
            />
            <FormInput
              v-model="modelForm.modelId"
              :label="t('ext.ka.settings.fieldModelId')"
              placeholder="e.g. z-ai/glm-5.2"
              required
            />
            <FormInput
              v-model="modelForm.displayName"
              :label="t('ext.ka.settings.fieldDisplayName')"
              placeholder="GLM 5.2"
              required
            />
            <FormInput
              v-model="modelForm.contextWindow"
              :label="t('ext.ka.settings.fieldContextWindow')"
              type="number"
            />
          </div>
          <button
            class="btn btn-primary"
            :disabled="createModelMutation.isPending.value || !modelForm.providerId"
            @click="createModelMutation.mutate()"
          >
            {{ createModelMutation.isPending.value ? t('ext.ka.settings.saving') : t('ext.ka.settings.addModel') }}
          </button>
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold">{{ t('ext.ka.settings.providers') }}</h2>
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
              class="card bg-base-100 shadow-sm border p-4 flex flex-col md:flex-row md:items-center gap-2"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold truncate">{{ p.name }}</h3>
                <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                  <span class="badge badge-sm badge-outline">{{ p.provider }}</span>
                  <code v-if="p.baseUrl" class="bg-base-200 px-1.5 py-0.5 rounded">{{ p.baseUrl }}</code>
                  <span v-else class="italic">—</span>
                </div>
              </div>
              <span
                :class="['badge badge-sm', p.enabled ? 'badge-success' : 'badge-ghost']"
              >
                {{ p.enabled ? t('ext.ka.settings.yes') : t('ext.ka.settings.no') }}
              </span>
            </article>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-lg font-semibold">{{ t('ext.ka.settings.models') }}</h2>
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
              class="card bg-base-100 shadow-sm border p-4 flex flex-col md:flex-row md:items-center gap-2"
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
                :class="['badge badge-sm', m.active ? 'badge-success' : 'badge-ghost']"
              >
                {{ m.active ? t('ext.ka.settings.yes') : t('ext.ka.settings.no') }}
              </span>
            </article>
          </div>
        </section>
      </template>
    </div>
  </ConfigLayout>
</template>