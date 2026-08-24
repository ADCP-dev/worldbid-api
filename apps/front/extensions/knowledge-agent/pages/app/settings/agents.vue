<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAgentConfig, useModelProviders } from '@ka/composables/useAgentConfig';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

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

const editing = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  systemPrompt: '',
  model: '',
  provider: 'openrouter',
});

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
  editing.value = false;
}

function startEdit(agent: {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  provider: string;
}) {
  editing.value = true;
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
  <SettingsLayout>
    <div class="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.agents') }}</h1>
        <p class="text-base-content/60 text-sm">
          {{ t('ext.ka.settings.agentsDescription') }}
        </p>
      </header>

      <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
        <h2 class="text-lg font-semibold">
          {{ editingId ? t('ext.ka.settings.newAgent') : t('ext.ka.settings.newAgent') }}
        </h2>
        <div class="grid gap-3">
          <FormInput
            v-model="form.name"
            label="Name"
            placeholder="Default Agent"
            required
          />
          <FormTextArea
            v-model="form.systemPrompt"
            label="System Prompt"
            :rows="5"
            placeholder="You are a knowledge manager..."
          />
          <div class="grid grid-cols-2 gap-3">
            <FormSelect
              v-model="form.provider"
              label="Provider"
              :options="providerOptions.length ? providerOptions : [
                { value: 'openrouter', label: 'openrouter' },
                { value: 'ollama', label: 'ollama' },
              ]"
            />
            <FormSelect
              v-model="form.model"
              label="Model"
              :options="modelOptions"
              placeholder="Select a model"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="btn btn-primary"
              :disabled="saveMutation.isPending.value || !form.name"
              @click="onSubmit"
            >
              {{ saveMutation.isPending.value ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
            </button>
            <button v-if="editingId" class="btn btn-ghost" @click="resetForm">
              Cancel
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
          No agent configs yet.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Updated</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in agents" :key="agent.id">
                <td class="font-medium">{{ agent.name }}</td>
                <td><code class="text-xs">{{ agent.model }}</code></td>
                <td>{{ agent.provider }}</td>
                <td class="text-xs text-base-content/60">
                  {{ new Date(agent.updatedAt).toLocaleString() }}
                </td>
                <td class="text-right space-x-2">
                  <button class="btn btn-xs btn-ghost" @click="startEdit(agent)">
                    Edit
                  </button>
                  <button
                    class="btn btn-xs btn-ghost text-error"
                    :disabled="deleteMutation.isPending.value"
                    @click="confirmDelete(agent.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </SettingsLayout>
</template>