<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useModelProviders } from '../../composables/useAgentConfig';

definePageMeta({
  layout: 'app',
});

const { getProviders, createProvider, getModels, createModel } =
  useModelProviders();
const queryClient = useQueryClient();

const { data: providers, isLoading: loadingProviders } = useQuery({
  queryKey: ['ka-providers'],
  queryFn: getProviders,
});

const { data: models, isLoading: loadingModels } = useQuery({
  queryKey: ['ka-models'],
  queryFn: () => getModels(),
});

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

const providerName = (id: string) =>
  providers.value?.find((p) => p.id === id)?.name ?? id;
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <header>
      <h1 class="text-2xl font-bold">Models</h1>
      <p class="text-base-content/60 text-sm">
        Manage LLM providers (Ollama, OpenRouter) and the models they expose.
      </p>
    </header>

    <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
      <h2 class="text-lg font-semibold">New Provider</h2>
      <div class="grid grid-cols-2 gap-3">
        <label class="form-control">
          <span class="label-text mb-1">Name</span>
          <input v-model="providerForm.name" type="text" class="input input-bordered w-full" />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">Provider</span>
          <select v-model="providerForm.provider" class="select select-bordered w-full">
            <option value="ollama">ollama</option>
            <option value="openrouter">openrouter</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text mb-1">Base URL</span>
          <input v-model="providerForm.baseUrl" type="text" class="input input-bordered w-full" />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">API Key Env Var Name</span>
          <input
            v-model="providerForm.apiKeyRef"
            type="text"
            class="input input-bordered w-full"
            placeholder="e.g. OPENROUTER_API_KEY"
          />
        </label>
      </div>
      <button
        class="btn btn-primary"
        :disabled="createProviderMutation.isPending.value"
        @click="createProviderMutation.mutate()"
      >
        {{ createProviderMutation.isPending.value ? 'Saving...' : 'Add Provider' }}
      </button>
      <p v-if="createProviderMutation.isError.value" class="text-error text-sm">
        {{ createProviderMutation.error?.message }}
      </p>
    </section>

    <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
      <h2 class="text-lg font-semibold">New Model</h2>
      <div class="grid grid-cols-2 gap-3">
        <label class="form-control">
          <span class="label-text mb-1">Provider</span>
          <select v-model="modelForm.providerId" class="select select-bordered w-full">
            <option value="" disabled>Select a provider</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text mb-1">Model ID</span>
          <input v-model="modelForm.modelId" type="text" class="input input-bordered w-full" placeholder="e.g. z-ai/glm-5.2" />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">Display Name</span>
          <input v-model="modelForm.displayName" type="text" class="input input-bordered w-full" />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">Context Window</span>
          <input v-model.number="modelForm.contextWindow" type="number" class="input input-bordered w-full" />
        </label>
      </div>
      <button
        class="btn btn-primary"
        :disabled="createModelMutation.isPending.value || !modelForm.providerId"
        @click="createModelMutation.mutate()"
      >
        {{ createModelMutation.isPending.value ? 'Saving...' : 'Add Model' }}
      </button>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Providers</h2>
      <div v-if="loadingProviders" class="flex justify-center py-4">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      <div v-else-if="!providers?.length" class="text-base-content/50 text-sm">
        No providers configured.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Base URL</th>
              <th>Enabled</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in providers" :key="p.id">
              <td class="font-medium">{{ p.name }}</td>
              <td>{{ p.provider }}</td>
              <td class="text-xs"><code>{{ p.baseUrl ?? '—' }}</code></td>
              <td>
                <span :class="['badge badge-sm', p.enabled ? 'badge-success' : 'badge-ghost']">
                  {{ p.enabled ? 'yes' : 'no' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Models</h2>
      <div v-if="loadingModels" class="flex justify-center py-4">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      <div v-else-if="!models?.length" class="text-base-content/50 text-sm">
        No models configured.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Model ID</th>
              <th>Display Name</th>
              <th>Provider</th>
              <th>Context</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in models" :key="m.id">
              <td><code class="text-xs">{{ m.modelId }}</code></td>
              <td class="font-medium">{{ m.displayName }}</td>
              <td>{{ providerName(m.providerId) }}</td>
              <td class="text-xs">{{ m.contextWindow.toLocaleString() }}</td>
              <td>
                <span :class="['badge badge-sm', m.active ? 'badge-success' : 'badge-ghost']">
                  {{ m.active ? 'yes' : 'no' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>