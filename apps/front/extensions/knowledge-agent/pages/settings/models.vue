<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@base/auth/stores/auth.store';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import { useModelProviders } from '../../composables/useAgentConfig';

definePageMeta({
  layout: 'app',
});

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

    <!-- Non-admin gate: backend rejects mutations with 403, but hide the UI too -->
    <div v-if="!isAdmin" class="alert alert-warning">
      <span>Admin access required to manage models and providers.</span>
    </div>

    <template v-else>
      <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
        <h2 class="text-lg font-semibold">New Provider</h2>
        <div class="grid grid-cols-2 gap-3">
          <FormInput
            v-model="providerForm.name"
            label="Name"
            placeholder="Ollama Cloud"
            required
          />
          <FormSelect
            v-model="providerForm.provider"
            label="Provider"
            :options="[
              { value: 'ollama', label: 'ollama' },
              { value: 'openrouter', label: 'openrouter' },
            ]"
          />
          <FormInput
            v-model="providerForm.baseUrl"
            label="Base URL"
            placeholder="https://cloud.ollama.ai"
          />
          <FormInput
            v-model="providerForm.apiKeyRef"
            label="API Key Env Var Name"
            placeholder="e.g. OPENROUTER_API_KEY"
            description="Name of the env var holding the key. Never store the key value in the DB."
          />
        </div>
        <button
          class="btn btn-primary"
          :disabled="createProviderMutation.isPending.value || !providerForm.name"
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
          <FormSelect
            v-model="modelForm.providerId"
            label="Provider"
            placeholder="Select a provider"
            :options="providerOptions"
            required
          />
          <FormInput
            v-model="modelForm.modelId"
            label="Model ID"
            placeholder="e.g. z-ai/glm-5.2"
            required
          />
          <FormInput
            v-model="modelForm.displayName"
            label="Display Name"
            placeholder="GLM 5.2"
            required
          />
          <FormInput
            v-model="modelForm.contextWindow"
            label="Context Window"
            type="number"
          />
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
    </template>
  </div>
</template>