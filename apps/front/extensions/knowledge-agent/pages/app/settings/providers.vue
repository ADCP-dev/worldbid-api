<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { Cpu, Database, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { useModelProviders } from '@ka/composables/useAgentConfig';
import type { Model, ModelProvider } from '@ka/composables/useAgentConfig';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
import KaFormModal from '@ka/components/KaFormModal.vue';
import { KA_SETTINGS_SECTIONS, type KaConfigSection } from '@ka/composables/useKaSettingsNav';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const sections = computed<KaConfigSection[]>(() => KA_SETTINGS_SECTIONS(t));

const {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getModels,
  createModel,
  updateModel,
  deleteModel,
} = useModelProviders();
const queryClient = useQueryClient();

const { data: providers, isLoading: providersLoading } = useQuery({
  queryKey: ['ka-providers'],
  queryFn: getProviders,
});

const { data: models, isLoading: modelsLoading } = useQuery({
  queryKey: ['ka-models'],
  queryFn: () => getModels(),
});

/** Provider name lookup for the model cards (models store providerId). */
const providerNameById = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const p of providers.value ?? []) map[p.id] = p.name;
  return map;
});

const providerSelectOptions = computed(() =>
  (providers.value ?? []).map((p) => ({ label: p.name, value: p.id })),
);

/* ── Provider management ─────────────────────────────────────────────── */
const providerModalOpen = ref(false);
const editingProviderId = ref<string | null>(null);
const isEditingProvider = computed(() => editingProviderId.value !== null);
const providerForm = ref({
  name: '',
  provider: 'ollama-cloud',
  baseUrl: '',
  apiKeyRef: '',
  enabled: true,
});

const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'ollama-cloud', label: 'Ollama Cloud' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
];

function openProviderModal(): void {
  editingProviderId.value = null;
  providerForm.value = {
    name: '',
    provider: 'ollama-cloud',
    baseUrl: 'https://ollama.com/api',
    apiKeyRef: '',
    enabled: true,
  };
  providerModalOpen.value = true;
}

function openEditProviderModal(provider: ModelProvider): void {
  editingProviderId.value = provider.id;
  providerForm.value = {
    name: provider.name,
    provider: provider.provider,
    baseUrl: provider.baseUrl ?? '',
    apiKeyRef: provider.apiKeyRef ?? '',
    enabled: provider.enabled,
  };
  providerModalOpen.value = true;
}

const saveProviderMutation = useMutation({
  mutationFn: () => {
    const payload = {
      name: providerForm.value.name,
      provider: providerForm.value.provider,
      apiKeyRef: providerForm.value.apiKeyRef || undefined,
      baseUrl: providerForm.value.baseUrl || undefined,
      enabled: providerForm.value.enabled,
    };
    if (editingProviderId.value) {
      return updateProvider(editingProviderId.value, payload);
    }
    return createProvider(payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-providers'] });
    toast.success(
      t(isEditingProvider.value ? 'ext.ka.settings.providerUpdated' : 'ext.ka.settings.providerSaved'),
    );
    providerModalOpen.value = false;
    editingProviderId.value = null;
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

function submitProvider(): void {
  if (!providerForm.value.name.trim()) return;
  saveProviderMutation.mutate();
}

const providerDeleteTarget = ref<ModelProvider | null>(null);
const providerDeleteDialogRef = ref<HTMLDialogElement | null>(null);

function askDeleteProvider(provider: ModelProvider): void {
  providerDeleteTarget.value = provider;
  providerDeleteDialogRef.value?.showModal();
}

function cancelDeleteProvider(): void {
  providerDeleteTarget.value = null;
  providerDeleteDialogRef.value?.close();
}

const deleteProviderMutation = useMutation({
  mutationFn: (id: string) => deleteProvider(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-providers'] });
    queryClient.invalidateQueries({ queryKey: ['ka-models'] });
    toast.success(t('ext.ka.settings.providerDeleted'));
    cancelDeleteProvider();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.deleteError', 'Delete failed'));
    cancelDeleteProvider();
  },
});

function confirmDeleteProvider(): void {
  if (providerDeleteTarget.value) deleteProviderMutation.mutate(providerDeleteTarget.value.id);
}

/* ── Models registry ─────────────────────────────────────────────────── */
const modelModalOpen = ref(false);
const editingModelId = ref<string | null>(null);
const isEditingModel = computed(() => editingModelId.value !== null);
const modelForm = ref({
  providerId: '',
  modelId: '',
  displayName: '',
  contextWindow: '' as string | number,
  active: true,
});

function openModelModal(): void {
  editingModelId.value = null;
  modelForm.value = {
    providerId: providers.value?.[0]?.id ?? '',
    modelId: '',
    displayName: '',
    contextWindow: '',
    active: true,
  };
  modelModalOpen.value = true;
}

function openEditModelModal(model: Model): void {
  editingModelId.value = model.id;
  modelForm.value = {
    providerId: model.providerId,
    modelId: model.modelId,
    displayName: model.displayName,
    contextWindow: model.contextWindow,
    active: model.active,
  };
  modelModalOpen.value = true;
}

const saveModelMutation = useMutation({
  mutationFn: () => {
    const payload = {
      providerId: modelForm.value.providerId,
      modelId: modelForm.value.modelId.trim(),
      displayName: modelForm.value.displayName.trim(),
      contextWindow: Number(modelForm.value.contextWindow) || 0,
      active: modelForm.value.active,
    };
    if (editingModelId.value) {
      return updateModel(editingModelId.value, payload);
    }
    return createModel(payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-models'] });
    toast.success(
      t(isEditingModel.value ? 'ext.ka.settings.modelUpdated' : 'ext.ka.settings.modelSaved'),
    );
    modelModalOpen.value = false;
    editingModelId.value = null;
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

function submitModel(): void {
  if (!modelForm.value.providerId) return;
  if (!modelForm.value.modelId.trim() || !modelForm.value.displayName.trim()) return;
  saveModelMutation.mutate();
}

const modelDeleteTarget = ref<Model | null>(null);
const modelDeleteDialogRef = ref<HTMLDialogElement | null>(null);

function askDeleteModel(model: Model): void {
  modelDeleteTarget.value = model;
  modelDeleteDialogRef.value?.showModal();
}

function cancelDeleteModel(): void {
  modelDeleteTarget.value = null;
  modelDeleteDialogRef.value?.close();
}

const deleteModelMutation = useMutation({
  mutationFn: (id: string) => deleteModel(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-models'] });
    toast.success(t('ext.ka.settings.modelDeleted'));
    cancelDeleteModel();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.deleteError', 'Delete failed'));
    cancelDeleteModel();
  },
});

function confirmDeleteModel(): void {
  if (modelDeleteTarget.value) deleteModelMutation.mutate(modelDeleteTarget.value.id);
}
</script>

<template>
  <ConfigLayout
    :sections="sections"
    active-key="providers"
    :title="t('ext.ka.nav.config')"
  >
    <div class="space-y-8">
      <header>
        <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.models') }}</h1>
        <p class="text-base-content/60 text-sm">
          {{ t('ext.ka.settings.modelsDescription') }}
        </p>
      </header>

      <!-- ── Providers section ───────��──────────────────────────────────── -->
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <Database :size="18" class="text-base-content/60" />
            {{ t('ext.ka.settings.providers') }}
          </h2>
          <button class="btn btn-primary btn-sm gap-1.5" @click="openProviderModal">
            <Plus :size="15" />
            {{ t('ext.ka.settings.addProvider') }}
          </button>
        </div>

        <div v-if="providersLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div
          v-else-if="!providers?.length"
          class="flex flex-col items-center justify-center py-10 text-center gap-2 border border-dashed border-base-300 rounded-xl"
        >
          <Database :size="26" class="text-base-content/30" />
          <p class="text-base-content/50">{{ t('ext.ka.settings.noProviders') }}</p>
          <button class="btn btn-sm btn-primary gap-1.5 mt-1" @click="openProviderModal">
            <Plus :size="14" />
            {{ t('ext.ka.settings.addProvider') }}
          </button>
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="p in providers"
            :key="p.id"
            class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ p.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                <span class="badge badge-sm badge-outline">{{ p.provider }}</span>
                <span class="badge badge-sm" :class="p.enabled ? 'badge-success' : 'badge-ghost'">
                  {{ p.enabled ? '✓' : '✗' }}
                </span>
                <code v-if="p.baseUrl" class="bg-base-200 px-1.5 py-0.5 rounded truncate max-w-[240px]">{{ p.baseUrl }}</code>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                class="btn btn-xs btn-ghost gap-1"
                :aria-label="t('ext.ka.settings.edit')"
                @click="openEditProviderModal(p)"
              >
                <Pencil :size="12" />
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error gap-1"
                :disabled="deleteProviderMutation.isPending.value"
                :aria-label="t('ext.ka.settings.delete')"
                @click="askDeleteProvider(p)"
              >
                <Trash2 :size="12" />
                {{ t('ext.ka.settings.delete') }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- ── Models registry section ────────────────────────────────────── -->
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <Cpu :size="18" class="text-base-content/60" />
            {{ t('ext.ka.settings.modelsSection') }}
          </h2>
          <button
            class="btn btn-primary btn-sm gap-1.5"
            :disabled="!providers?.length"
            @click="openModelModal"
          >
            <Plus :size="15" />
            {{ t('ext.ka.settings.addModel') }}
          </button>
        </div>

        <div v-if="modelsLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div
          v-else-if="!models?.length"
          class="flex flex-col items-center justify-center py-10 text-center gap-2 border border-dashed border-base-300 rounded-xl"
        >
          <Cpu :size="26" class="text-base-content/30" />
          <p class="text-base-content/50">{{ t('ext.ka.settings.noModels') }}</p>
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="m in models"
            :key="m.id"
            class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ m.displayName }}</h3>
              <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                <code class="bg-base-200 px-1.5 py-0.5 rounded">{{ m.modelId }}</code>
                <span class="badge badge-sm badge-outline">
                  {{ providerNameById[m.providerId] ?? m.providerId }}
                </span>
                <span v-if="m.contextWindow" class="text-base-content/40">
                  {{ m.contextWindow.toLocaleString() }} ctx
                </span>
                <span class="badge badge-sm" :class="m.active ? 'badge-success' : 'badge-ghost'">
                  {{ m.active ? '✓' : '✗' }}
                </span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                class="btn btn-xs btn-ghost gap-1"
                :aria-label="t('ext.ka.settings.edit')"
                @click="openEditModelModal(m)"
              >
                <Pencil :size="12" />
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error gap-1"
                :disabled="deleteModelMutation.isPending.value"
                :aria-label="t('ext.ka.settings.delete')"
                @click="askDeleteModel(m)"
              >
                <Trash2 :size="12" />
                {{ t('ext.ka.settings.delete') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- Provider modal (create / edit) -->
    <KaFormModal
      v-model="providerModalOpen"
      :title="isEditingProvider ? t('ext.ka.settings.editProvider') : t('ext.ka.settings.newProvider')"
      :loading="saveProviderMutation.isPending.value"
      :submit-label="isEditingProvider ? t('ext.ka.settings.update') : t('ext.ka.settings.addProvider')"
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
        placeholder="https://ollama.com/api"
        :description="t('ext.ka.settings.baseUrlHint', 'Default endpoint for the selected provider')"
      />
      <FormInput
        v-model="providerForm.apiKeyRef"
        :label="t('ext.ka.settings.fieldApiKey')"
        placeholder="e.g. 39b70be2... (your Ollama Cloud key)"
        :description="t('ext.ka.settings.apiKeyRefHint', 'Env var name or the literal API key.')"
      />
      <FormSwitch
        v-model="providerForm.enabled"
        :label="t('ext.ka.settings.fieldEnabled')"
      />
    </KaFormModal>

    <!-- Provider delete confirmation -->
    <dialog ref="providerDeleteDialogRef" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="font-semibold text-base mb-1">
          {{ t('ext.ka.settings.deleteProviderTitle') }}
        </h3>
        <p class="text-sm text-base-content/70">
          {{
            t('ext.ka.settings.deleteProviderBody')
              .replace('{name}', providerDeleteTarget?.name ?? '')
          }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" type="button" @click="cancelDeleteProvider">
            {{ t('ext.ka.settings.cancel') }}
          </button>
          <button
            class="btn btn-error btn-sm gap-1"
            type="button"
            :disabled="deleteProviderMutation.isPending.value"
            @click="confirmDeleteProvider"
          >
            <span v-if="deleteProviderMutation.isPending.value" class="loading loading-spinner loading-xs" />
            {{ t('ext.ka.settings.delete') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="cancelDeleteProvider" />
    </dialog>

    <!-- Model modal (create / edit) -->
    <KaFormModal
      v-model="modelModalOpen"
      :title="isEditingModel ? t('ext.ka.settings.editModel') : t('ext.ka.settings.newModel')"
      :loading="saveModelMutation.isPending.value"
      :submit-label="isEditingModel ? t('ext.ka.settings.update') : t('ext.ka.settings.addModel')"
      @submit="submitModel"
    >
      <FormSelect
        v-model="modelForm.providerId"
        :label="t('ext.ka.settings.fieldProvider')"
        :options="providerSelectOptions"
        :placeholder="t('ext.ka.settings.selectProvider')"
      />
      <FormInput
        v-model="modelForm.displayName"
        :label="t('ext.ka.settings.fieldDisplayName')"
        placeholder="GLM 5.3 Flash"
        required
      />
      <FormInput
        v-model="modelForm.modelId"
        :label="t('ext.ka.settings.fieldModelId')"
        placeholder="z-ai/glm-5.3-flash"
        :description="t('ext.ka.settings.modelIdHint', 'Identifier the provider API expects for this model.')"
        required
      />
      <FormInput
        v-model="modelForm.contextWindow"
        type="number"
        :label="t('ext.ka.settings.fieldContextWindow')"
        placeholder="128000"
        min="0"
      />
      <FormSwitch
        v-model="modelForm.active"
        :label="t('ext.ka.settings.fieldEnabled')"
      />
    </KaFormModal>

    <!-- Model delete confirmation -->
    <dialog ref="modelDeleteDialogRef" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="font-semibold text-base mb-1">
          {{ t('ext.ka.settings.deleteModelTitle') }}
        </h3>
        <p class="text-sm text-base-content/70">
          {{
            t('ext.ka.settings.deleteModelBody')
              .replace('{name}', modelDeleteTarget?.displayName ?? '')
          }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" type="button" @click="cancelDeleteModel">
            {{ t('ext.ka.settings.cancel') }}
          </button>
          <button
            class="btn btn-error btn-sm gap-1"
            type="button"
            :disabled="deleteModelMutation.isPending.value"
            @click="confirmDeleteModel"
          >
            <span v-if="deleteModelMutation.isPending.value" class="loading loading-spinner loading-xs" />
            {{ t('ext.ka.settings.delete') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="cancelDeleteModel" />
    </dialog>
  </ConfigLayout>
</template>
