<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAgentConfig, useModelProviders } from '@ka/composables/useAgentConfig';

definePageMeta({
  layout: 'app',
});

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

const editing = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  systemPrompt: '',
  model: 'openrouter:z-ai/glm-5.2',
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
    model: 'openrouter:z-ai/glm-5.2',
    provider: 'openrouter',
  };
  editingId.value = null;
  editing.value = false;
}

function startEdit(agent: { id: string; name: string; systemPrompt: string; model: string; provider: string }) {
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
    if (editingId.value) {
      return updateAgentConfig(editingId.value, { ...form.value });
    }
    return createAgentConfig({ ...form.value });
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

function buildModelString(provider: string, modelId: string): string {
  return `${provider}:${modelId}`;
}

function onSubmit() {
  saveMutation.mutate();
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <header>
      <h1 class="text-2xl font-bold">Agent Configs</h1>
      <p class="text-base-content/60 text-sm">
        Configure DeepAgent runtime: system prompt, model, and provider.
      </p>
    </header>

    <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
      <h2 class="text-lg font-semibold">
        {{ editingId ? 'Edit Agent' : 'New Agent' }}
      </h2>
      <div class="grid gap-3">
        <label class="form-control">
          <span class="label-text mb-1">Name</span>
          <input v-model="form.name" type="text" class="input input-bordered w-full" />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">System Prompt</span>
          <textarea
            v-model="form.systemPrompt"
            rows="5"
            class="textarea textarea-bordered w-full"
          ></textarea>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="form-control">
            <span class="label-text mb-1">Provider</span>
            <select v-model="form.provider" class="select select-bordered w-full">
              <option value="openrouter">openrouter</option>
              <option value="ollama">ollama</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Model</span>
            <input
              v-model="form.model"
              type="text"
              class="input input-bordered w-full"
              :placeholder="`e.g. ${buildModelString(form.provider, 'z-ai/glm-5.2')}`"
            />
          </label>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-primary"
            :disabled="saveMutation.isPending.value"
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
        <span class="loading loading-spinner loading-lg"></span>
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
                  @click="deleteMutation.mutate(agent.id)"
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
</template>