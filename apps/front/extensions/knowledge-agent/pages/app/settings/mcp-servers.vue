<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useMcpServers, type McpServer } from '@ka/composables/useAgentConfig';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
import { KA_SETTINGS_SECTIONS, type KaConfigSection } from '@ka/composables/useKaSettingsNav';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { t } = useI18n();

const sections = computed<KaConfigSection[]>(() => KA_SETTINGS_SECTIONS(t));

const { getServers, createServer, updateServer, deleteServer } = useMcpServers();
const queryClient = useQueryClient();

const { data: servers, isLoading } = useQuery({
  queryKey: ['ka-mcp-servers'],
  queryFn: getServers,
});

const TRANSPORT_OPTIONS = [
  { value: 'http', label: 'http' },
  { value: 'stdio', label: 'stdio' },
];

const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  transport: 'http',
  url: '',
  apiKeyRef: '',
  enabled: true,
});

const isEditing = computed(() => editingId.value !== null);

function resetForm() {
  form.value = {
    name: '',
    transport: 'http',
    url: '',
    apiKeyRef: '',
    enabled: true,
  };
  editingId.value = null;
}

function startEdit(s: McpServer) {
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

const toggleMutation = useMutation({
  mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
    updateServer(id, { enabled }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
  },
});

function confirmDelete(id: string) {
  if (!confirm(t('ext.ka.chat.deleteConfirm'))) return;
  deleteMutation.mutate(id);
}

function onSubmit() {
  saveMutation.mutate();
}

function toggleEnabled(s: McpServer) {
  toggleMutation.mutate({ id: s.id, enabled: !s.enabled });
}
</script>

<template>
  <ConfigLayout
    :sections="sections"
    active-key="mcp"
    :title="t('ext.ka.nav.config')"
  >
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.mcp') }}</h1>
        <p class="text-base-content/60 text-sm">
          {{ t('ext.ka.settings.mcpDescription') }}
        </p>
      </header>

      <section class="card bg-base-100 shadow-sm border p-5 space-y-4">
        <h2 class="text-lg font-semibold">
          {{ isEditing ? t('ext.ka.settings.editMcpServer') : t('ext.ka.settings.newMcpServer') }}
        </h2>
        <div class="grid gap-3">
          <FormInput
            v-model="form.name"
            :label="t('ext.ka.settings.fieldName')"
            placeholder="e.g. GitHub MCP"
            required
          />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormSelect
              v-model="form.transport"
              :label="t('ext.ka.settings.fieldTransport')"
              :options="TRANSPORT_OPTIONS"
            />
            <FormSwitch
              v-model="form.enabled"
              :label="t('ext.ka.settings.fieldEnabled')"
            />
          </div>
          <FormInput
            v-model="form.url"
            :label="form.transport === 'http' ? t('ext.ka.settings.fieldUrl') : t('ext.ka.settings.fieldCommand')"
            :placeholder="form.transport === 'http' ? 'https://mcp.example.com/api' : 'npx -y @mcp/server'"
          />
          <FormInput
            v-model="form.apiKeyRef"
            :label="t('ext.ka.settings.fieldApiKeyRef')"
            placeholder="MCP_API_KEY"
            :description="t('ext.ka.settings.apiKeyRefOptional')"
          />
          <div class="flex gap-2">
            <button
              class="btn btn-primary"
              :disabled="saveMutation.isPending.value"
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
        <div v-else-if="!servers?.length" class="text-base-content/50 text-center py-8">
          {{ t('ext.ka.settings.noMcpServers') }}
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="s in servers"
            :key="s.id"
            class="card bg-base-100 shadow-sm border p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ s.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                <span class="badge badge-sm badge-outline">{{ s.transport }}</span>
                <code class="bg-base-200 px-1.5 py-0.5 rounded truncate max-w-xs" :title="s.url">{{ s.url }}</code>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <FormSwitch
                :model-value="s.enabled"
                :label="t('ext.ka.settings.fieldEnabled')"
                @update:model-value="toggleEnabled(s)"
              />
              <button class="btn btn-xs btn-ghost" @click="startEdit(s)">
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error"
                :disabled="deleteMutation.isPending.value"
                @click="confirmDelete(s.id)"
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