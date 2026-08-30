<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { useAgentConfig, useModelProviders } from '@ka/composables/useAgentConfig';
import type { AgentConfig, ModelProvider } from '@ka/composables/useAgentConfig';
import { useProviderModels } from '@ka/composables/useProviderModels';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
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
  getAgentConfigs,
  createAgentConfig,
  updateAgentConfig,
  deleteAgentConfig,
} = useAgentConfig();
const { getProviders } = useModelProviders();
const queryClient = useQueryClient();

const { data: agents, isLoading } = useQuery({
  queryKey: ['ka-agent-configs'],
  queryFn: getAgentConfigs,
});

const { data: providers } = useQuery({
  queryKey: ['ka-providers'],
  queryFn: getProviders,
});

const providerOptions = computed(() =>
  (providers.value ?? []).map((p) => ({ label: p.name, value: p.provider })),
);

/* ── Cascading provider → model fetch ────────────────────────────────────
 * When the user picks a provider in the form, we fetch that provider's
 * available models directly from its API (Ollama /api/tags, OpenRouter
 * /api/v1/models). The model list is NOT stored in the DB — only the user's
 * choice (provider:modelId) is persisted in AgentConfig.model. Free-text
 * input is also allowed (for custom/self-hosted models not in the list).
 */
const { models: providerModels, loading: modelsLoading, error: modelsError, fetchModels } = useProviderModels();

/* ── Form state (declared BEFORE computeds that reference it) ──────────── */
const modalOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  systemPrompt: '',
  model: '',
  provider: 'openrouter',
});

/** Currently selected provider object (from DB), based on form.provider. */
const selectedProvider = computed<ModelProvider | null>(() => {
  const ps = providers.value ?? [];
  return ps.find((p) => p.provider === form.value.provider) ?? null;
});

/** Options for the model select: fetched models + allow free text. */
const modelOptions = computed(() => {
  return providerModels.value.map((m) => ({
    label: m.name,
    value: `${selectedProvider.value?.provider ?? ''}:${m.id}`,
  }));
});

// Fetch models whenever the provider changes.
watch(selectedProvider, (p) => {
  form.value.model = ''; // reset model when provider changes
  void fetchModels(p);
});

/** Allow free-text model input (for models not in the fetched list). */
const allowFreeTextModel = ref(false);
const freeTextModelId = ref('');
function applyFreeTextModel(): void {
  if (!freeTextModelId.value.trim() || !selectedProvider.value) return;
  form.value.model = `${selectedProvider.value.provider}:${freeTextModelId.value.trim()}`;
  freeTextModelId.value = '';
  allowFreeTextModel.value = false;
}

const isEditing = computed(() => editingId.value !== null);

function openCreateModal(): void {
  editingId.value = null;
  form.value = {
    name: '',
    systemPrompt: '',
    model: '',
    provider: providers.value?.[0]?.provider ?? 'openrouter',
  };
  modalOpen.value = true;
}

function openEditModal(agent: AgentConfig): void {
  editingId.value = agent.id;
  form.value = {
    name: agent.name,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    provider: agent.provider,
  };
  modalOpen.value = true;
}

function closeModal(): void {
  modalOpen.value = false;
  editingId.value = null;
}

/* ── Delete confirmation ──────────────────────────────────────────────── */
const deleteTarget = ref<AgentConfig | null>(null);
const deleteDialogRef = ref<HTMLDialogElement | null>(null);

function askDelete(agent: AgentConfig): void {
  deleteTarget.value = agent;
  deleteDialogRef.value?.showModal();
}
function cancelDelete(): void {
  deleteTarget.value = null;
  deleteDialogRef.value?.close();
}

/* ── Mutations ────────────────────────────────────────────────────────── */
const saveMutation = useMutation({
  mutationFn: async () => {
    const payload = {
      name: form.value.name,
      systemPrompt: form.value.systemPrompt,
      model: form.value.model,
      provider: form.value.provider,
    };
    if (editingId.value) {
      return updateAgentConfig(editingId.value, payload);
    }
    return createAgentConfig(payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-agent-configs'] });
    toast.success(t('ext.ka.settings.agentSaved', 'Agent saved'));
    closeModal();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAgentConfig(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-agent-configs'] });
    toast.success(t('ext.ka.settings.agentDeleted', 'Agent deleted'));
    cancelDelete();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.deleteError', 'Delete failed'));
    cancelDelete();
  },
});

function confirmDelete(): void {
  if (deleteTarget.value) deleteMutation.mutate(deleteTarget.value.id);
}

function onSubmit(): void {
  if (!form.value.name.trim()) return;
  saveMutation.mutate();
}
</script>

<template>
  <ConfigLayout
    :sections="sections"
    active-key="agents"
    :title="t('ext.ka.nav.config')"
  >
    <div class="space-y-6">
      <header class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.agents') }}</h1>
          <p class="text-base-content/60 text-sm">
            {{ t('ext.ka.settings.agentsDescription') }}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary btn-sm gap-1.5" @click="openCreateModal">
            <Plus :size="15" />
            {{ t('ext.ka.settings.newAgent') }}
          </button>
        </div>
      </header>

      <section class="space-y-3">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div
          v-else-if="!agents?.length"
          class="flex flex-col items-center justify-center py-14 text-center gap-2"
        >
          <Bot :size="28" class="text-base-content/30" />
          <p class="text-base-content/50">{{ t('ext.ka.settings.noAgents') }}</p>
          <button class="btn btn-sm btn-primary gap-1.5 mt-2" @click="openCreateModal">
            <Plus :size="14" />
            {{ t('ext.ka.settings.newAgent') }}
          </button>
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="agent in agents"
            :key="agent.id"
            class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ agent.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                <code class="bg-base-200 px-1.5 py-0.5 rounded">{{ agent.model }}</code>
                <span class="badge badge-sm badge-outline">{{ agent.provider }}</span>
                <span>{{ new Date(agent.updatedAt).toLocaleString() }}</span>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                class="btn btn-xs btn-ghost gap-1"
                :aria-label="t('ext.ka.settings.edit')"
                @click="openEditModal(agent)"
              >
                <Pencil :size="12" />
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error gap-1"
                :disabled="deleteMutation.isPending.value"
                :aria-label="t('ext.ka.settings.delete')"
                @click="askDelete(agent)"
              >
                <Trash2 :size="12" />
                {{ t('ext.ka.settings.delete') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- Create/Edit modal -->
    <KaFormModal
      v-model="modalOpen"
      :title="isEditing ? t('ext.ka.settings.editAgent') : t('ext.ka.settings.newAgent')"
      :loading="saveMutation.isPending.value"
      :submit-label="isEditing ? t('ext.ka.settings.update') : t('ext.ka.settings.create')"
      @submit="onSubmit"
    >
      <FormInput
        v-model="form.name"
        :label="t('ext.ka.settings.fieldName')"
        placeholder="Default Agent"
        required
      />
      <FormTextArea
        v-model="form.systemPrompt"
        :label="t('ext.ka.settings.fieldSystemPrompt')"
        :rows="5"
        placeholder="You are a knowledge manager..."
      />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormSelect
          v-model="form.provider"
          :label="t('ext.ka.settings.fieldProvider')"
          :options="providerOptions.length ? providerOptions : [
            { value: 'openrouter', label: 'openrouter' },
            { value: 'ollama', label: 'ollama' },
            { value: 'ollama-cloud', label: 'ollama-cloud' },
          ]"
        />
        <div class="space-y-1">
          <label class="text-sm font-medium text-base-content/70">
            {{ t('ext.ka.settings.fieldModel') }}
          </label>
          <div v-if="modelsLoading" class="flex items-center gap-2 text-sm text-base-content/50">
            <span class="loading loading-spinner loading-xs" />
            {{ t('ext.ka.settings.fetchingModels', 'Fetching models…') }}
          </div>
          <FormSelect
            v-else-if="!allowFreeTextModel && modelOptions.length > 0"
            v-model="form.model"
            :options="modelOptions"
            :placeholder="t('ext.ka.settings.selectModel')"
          />
          <div v-else-if="allowFreeTextModel" class="flex gap-1">
            <input
              v-model="freeTextModelId"
              type="text"
              :placeholder="t('ext.ka.settings.modelIdPlaceholder', 'e.g. glm-5.3-flash:cloud')"
              class="input input-sm input-bordered flex-1"
              @keyup.enter="applyFreeTextModel"
            >
            <button class="btn btn-xs btn-primary" @click="applyFreeTextModel">
              {{ t('ext.ka.settings.apply', 'Apply') }}
            </button>
            <button class="btn btn-xs btn-ghost" @click="allowFreeTextModel = false">
              {{ t('ext.ka.settings.cancel') }}
            </button>
          </div>
          <div v-else class="flex gap-2 items-center">
            <span class="text-xs text-base-content/50">{{ t('ext.ka.settings.noModelsFetched', 'No models fetched') }}</span>
            <button class="btn btn-xs btn-ghost" @click="allowFreeTextModel = true">
              {{ t('ext.ka.settings.enterModelManually', 'Enter manually') }}
            </button>
          </div>
          <p v-if="modelsError" class="text-xs text-error/70">{{ modelsError }}</p>
          <p v-if="form.model" class="text-xs text-base-content/40">
            {{ t('ext.ka.settings.selectedModel', 'Selected') }}: <code class="bg-base-200 px-1 rounded">{{ form.model }}</code>
          </p>
        </div>
      </div>
    </KaFormModal>

    <!-- Delete confirmation -->
    <dialog ref="deleteDialogRef" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="font-semibold text-base mb-1">
          {{ t('ext.ka.settings.deleteAgentTitle', 'Delete agent?') }}
        </h3>
        <p class="text-sm text-base-content/70">
          {{
            t('ext.ka.settings.deleteAgentBody', '"{name}" will be permanently deleted.')
              .replace('{name}', deleteTarget?.name ?? '')
          }}
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" type="button" @click="cancelDelete">
            {{ t('ext.ka.settings.cancel') }}
          </button>
          <button
            class="btn btn-error btn-sm gap-1"
            type="button"
            :disabled="deleteMutation.isPending.value"
            @click="confirmDelete"
          >
            <span v-if="deleteMutation.isPending.value" class="loading loading-spinner loading-xs" />
            {{ t('ext.ka.settings.delete') }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="cancelDelete" />
    </dialog>

  </ConfigLayout>
</template>
