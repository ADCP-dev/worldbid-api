<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAgentConfig, useModelProviders } from '@ka/composables/useAgentConfig';
import type { AgentConfig } from '@ka/composables/useAgentConfig';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
import { KA_SETTINGS_SECTIONS, type KaConfigSection } from '@ka/composables/useKaSettingsNav';

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
const { getProviders, getActiveModels } = useModelProviders();
const queryClient = useQueryClient();

const { data: agents, isLoading } = useQuery({
  queryKey: ['ka-agent-configs'],
  queryFn: getAgentConfigs,
});

const { data: providers } = useQuery({
  queryKey: ['ka-providers'],
  queryFn: getProviders,
});

const { data: activeModels } = useQuery({
  queryKey: ['ka-active-models'],
  queryFn: getActiveModels,
});

const providerOptions = computed(() =>
  (providers.value ?? []).map((p) => ({ label: p.name, value: p.provider })),
);

const modelOptions = computed(() => {
  const ps = providers.value ?? [];
  return (activeModels.value ?? []).map((m) => {
    const p = ps.find((x) => x.id === m.providerId);
    const provider = p?.provider ?? 'unknown';
    return {
      label: `${m.displayName} (${provider}:${m.modelId})`,
      value: `${provider}:${m.modelId}`,
    };
  });
});

const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  systemPrompt: '',
  model: '',
  provider: 'openrouter',
});

const isEditing = computed(() => editingId.value !== null);

watch(providers, (ps) => {
  if (ps && ps.length > 0 && !form.value.provider) {
    form.value.provider = ps[0].provider;
  }
});

function resetForm() {
  form.value = {
    name: '',
    systemPrompt: '',
    model: '',
    provider: 'openrouter',
  };
  editingId.value = null;
}

function startEdit(agent: AgentConfig) {
  editingId.value = agent.id;
  form.value = {
    name: agent.name,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    provider: agent.provider,
  };
}

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
    resetForm();
  },
});

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAgentConfig(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-agent-configs'] });
  },
});

function confirmDelete(id: string) {
  if (!confirm(t('ext.ka.notes.deleteConfirm'))) return;
  deleteMutation.mutate(id);
}

function onSubmit() {
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
      <header>
        <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.agents') }}</h1>
        <p class="text-base-content/60 text-sm">
          {{ t('ext.ka.settings.agentsDescription') }}
        </p>
      </header>

      <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
        <h2 class="text-lg font-semibold">
          {{ isEditing ? t('ext.ka.settings.editAgent') : t('ext.ka.settings.newAgent') }}
        </h2>
        <div class="grid gap-3">
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
            <FormSelect
              v-model="form.model"
              :label="t('ext.ka.settings.fieldModel')"
              :options="modelOptions"
              :placeholder="t('ext.ka.settings.selectModel')"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="btn btn-primary"
              :disabled="saveMutation.isPending.value || !form.name"
              @click="onSubmit"
            >
              {{ saveMutation.isPending.value ? t('ext.ka.settings.saving') : (isEditing ? t('ext.ka.settings.update') : t('ext.ka.settings.create')) }}
            </button>
            <button v-if="isEditing" class="btn btn-ghost" @click="resetForm">
              {{ t('ext.ka.settings.cancel') }}
            </button>
          </div>
          <p v-if="saveMutation.isError.value" class="text-error text-sm">
            {{ saveMutation.error?.message }}
          </p>
        </div>
      </section>

      <section class="space-y-3">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div v-else-if="!agents?.length" class="text-base-content/50 text-center py-8">
          {{ t('ext.ka.settings.noAgents') }}
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="agent in agents"
            :key="agent.id"
            class="card bg-base-100 shadow-sm border p-4 flex flex-col md:flex-row md:items-center gap-3"
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
              <button class="btn btn-xs btn-ghost" @click="startEdit(agent)">
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error"
                :disabled="deleteMutation.isPending.value"
                @click="confirmDelete(agent.id)"
              >
                {{ t('ext.ka.settings.delete') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </ConfigLayout>
</template>