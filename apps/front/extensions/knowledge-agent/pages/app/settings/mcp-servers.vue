<script setup lang="ts">
import { ref } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useMcpServers, type McpServer } from '@ka/composables/useAgentConfig';

definePageMeta({
  layout: 'app',
});

const { getServers, createServer, updateServer, deleteServer } = useMcpServers();
const queryClient = useQueryClient();

const { data: servers, isLoading } = useQuery({
  queryKey: ['ka-mcp-servers'],
  queryFn: getServers,
});

const editing = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  transport: 'http',
  url: '',
  apiKeyRef: '',
  enabled: true,
});

function resetForm() {
  form.value = {
    name: '',
    transport: 'http',
    url: '',
    apiKeyRef: '',
    enabled: true,
  };
  editingId.value = null;
  editing.value = false;
}

function startEdit(s: McpServer) {
  editing.value = true;
  editingId.value = s.id;
  form.value = {
    name: s.name,
    transport: s.transport,
    url: s.url,
    apiKeyRef: s.apiKeyRef ?? '',
    enabled: s.enabled,
  };
}

const saveMutation = useMutation({
  mutationFn: async () => {
    const payload = {
      name: form.value.name,
      transport: form.value.transport,
      url: form.value.url,
      apiKeyRef: form.value.apiKeyRef || undefined,
      enabled: form.value.enabled,
    };
    if (editingId.value) {
      return updateServer(editingId.value, payload);
    }
    return createServer(payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
    resetForm();
  },
});

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteServer(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
  },
});

function onSubmit() {
  saveMutation.mutate();
}

function toggleEnabled(s: McpServer) {
  updateServer(s.id, { enabled: !s.enabled }).then(() => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
  });
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <header>
      <h1 class="text-2xl font-bold">MCP Servers</h1>
      <p class="text-base-content/60 text-sm">
        External MCP server registry. The agent loads tools from enabled servers.
      </p>
    </header>

    <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
      <h2 class="text-lg font-semibold">
        {{ editingId ? 'Edit Server' : 'New Server' }}
      </h2>
      <div class="grid gap-3">
        <label class="form-control">
          <span class="label-text mb-1">Name</span>
          <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g. GitHub MCP" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="form-control">
            <span class="label-text mb-1">Transport</span>
            <select v-model="form.transport" class="select select-bordered w-full">
              <option value="http">http</option>
              <option value="stdio">stdio</option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text mb-1">Enabled</span>
            <select v-model="form.enabled" class="select select-bordered w-full">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
          </label>
        </div>
        <label class="form-control">
          <span class="label-text mb-1">URL (http) or Command (stdio)</span>
          <input
            v-model="form.url"
            type="text"
            class="input input-bordered w-full"
            :placeholder="form.transport === 'http' ? 'https://mcp.example.com/api' : 'npx -y @mcp/server'"
          />
        </label>
        <label class="form-control">
          <span class="label-text mb-1">API Key Ref (optional — env var name)</span>
          <input v-model="form.apiKeyRef" type="text" class="input input-bordered w-full" placeholder="MCP_API_KEY" />
        </label>
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
      <div v-else-if="!servers?.length" class="text-base-content/50 text-center py-8">
        No MCP servers configured.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Name</th>
              <th>Transport</th>
              <th>URL / Command</th>
              <th>Enabled</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in servers" :key="s.id">
              <td class="font-medium">{{ s.name }}</td>
              <td><code class="text-xs">{{ s.transport }}</code></td>
              <td class="text-xs text-base-content/60 max-w-xs truncate" :title="s.url">{{ s.url }}</td>
              <td>
                <button
                  class="btn btn-xs"
                  :class="s.enabled ? 'btn-success' : 'btn-ghost'"
                  @click="toggleEnabled(s)"
                >
                  {{ s.enabled ? 'ON' : 'OFF' }}
                </button>
              </td>
              <td class="text-right space-x-2">
                <button class="btn btn-xs btn-ghost" @click="startEdit(s)">
                  Edit
                </button>
                <button
                  class="btn btn-xs btn-ghost text-error"
                  :disabled="deleteMutation.isPending.value"
                  @click="deleteMutation.mutate(s.id)"
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