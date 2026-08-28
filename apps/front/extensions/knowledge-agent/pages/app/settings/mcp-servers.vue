<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { toast } from 'vue-sonner';
import { Pencil, Plug, Plus, Trash2, Globe } from 'lucide-vue-next';
import { useMcpServers, type McpServer } from '@ka/composables/useAgentConfig';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import KeyValueEditor from '@base/ui-app/components/form/KeyValueEditor.vue';
import ConfigLayout from '@ka/components/ConfigLayout.vue';
import KaFormModal from '@ka/components/KaFormModal.vue';
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

/* ── Modal state ───────────────────────────────────────────────────── */
const modalOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  transport: 'http',
  url: '',
  apiKeyRef: '',
  headers: {} as Record<string, string>,
  enabled: true,
});

const isEditing = computed(() => editingId.value !== null);

function openCreateModal(): void {
  editingId.value = null;
  form.value = {
    name: '',
    transport: 'http',
    url: '',
    apiKeyRef: '',
    headers: {},
    enabled: true,
  };
  modalOpen.value = true;
}

function openEditModal(s: McpServer): void {
  editingId.value = s.id;
  form.value = {
    name: s.name,
    transport: s.transport,
    url: s.url,
    apiKeyRef: s.apiKeyRef ?? '',
    headers: s.headers ? { ...s.headers } : {},
    enabled: s.enabled,
  };
  modalOpen.value = true;
}

function closeModal(): void {
  modalOpen.value = false;
  editingId.value = null;
}

/* ── Delete confirmation ───────────────────────────────────────────── */
const deleteTarget = ref<McpServer | null>(null);
const deleteDialogRef = ref<HTMLDialogElement | null>(null);

function askDelete(s: McpServer): void {
  deleteTarget.value = s;
  deleteDialogRef.value?.showModal();
}
function cancelDelete(): void {
  deleteTarget.value = null;
  deleteDialogRef.value?.close();
}

/* ── Mutations ─────────────────────────────────────────────────────── */
const saveMutation = useMutation({
  mutationFn: async () => {
    const headers =
      Object.keys(form.value.headers).length > 0 ? { ...form.value.headers } : undefined;
    const payload = {
      name: form.value.name,
      transport: form.value.transport,
      url: form.value.url,
      apiKeyRef: form.value.apiKeyRef || undefined,
      headers,
      enabled: form.value.enabled,
    };
    if (editingId.value) {
      return updateServer(editingId.value, payload);
    }
    return createServer(payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
    toast.success(t('ext.ka.settings.mcpSaved', 'MCP server saved'));
    closeModal();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteServer(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
    toast.success(t('ext.ka.settings.mcpDeleted', 'MCP server deleted'));
    cancelDelete();
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.deleteError', 'Delete failed'));
    cancelDelete();
  },
});

const toggleMutation = useMutation({
  mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
    updateServer(id, { enabled }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

function confirmDelete(): void {
  if (deleteTarget.value) deleteMutation.mutate(deleteTarget.value.id);
}

function onSubmit(): void {
  if (!form.value.name.trim() || !form.value.url.trim()) return;
  saveMutation.mutate();
}

function toggleEnabled(s: McpServer): void {
  toggleMutation.mutate({ id: s.id, enabled: !s.enabled });
}

/* ── Tavily one-click integration ─────────────────────────────────────── */
const TAVILY_MCP_URL = 'https://mcp.tavily.com/mcp/?tavilyApiKey=';
const tavilyModalOpen = ref(false);
const tavilyKey = ref('');
const tavilyConnected = computed(() =>
  (servers.value ?? []).some((s) => s.name === 'tavily'),
);

function openTavilyModal(): void {
  tavilyKey.value = '';
  tavilyModalOpen.value = true;
}

const addTavilyMutation = useMutation({
  mutationFn: () =>
    createServer({
      name: 'tavily',
      transport: 'http',
      url: `${TAVILY_MCP_URL}${tavilyKey.value.trim()}`,
      enabled: true,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['ka-mcp-servers'] });
    toast.success(t('ext.ka.settings.tavilyAdded', 'Tavily conectado'));
    tavilyModalOpen.value = false;
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : t('ext.ka.settings.saveError', 'Save failed'));
  },
});

function submitTavily(): void {
  if (!tavilyKey.value.trim()) return;
  addTavilyMutation.mutate();
}
</script>

<template>
  <ConfigLayout
    :sections="sections"
    active-key="mcp"
    :title="t('ext.ka.nav.config')"
  >
    <div class="space-y-6">
      <header class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ t('ext.ka.settings.mcp') }}</h1>
          <p class="text-base-content/60 text-sm">
            {{ t('ext.ka.settings.mcpDescription') }}
          </p>
        </div>
        <button class="btn btn-primary btn-sm gap-1.5" @click="openCreateModal">
          <Plus :size="15" />
          {{ t('ext.ka.settings.newMcpServer') }}
        </button>
      </header>

      <!-- ── Integrations menu: one-click MCP presets ──────────────────── -->
      <section class="card bg-base-200/40 border border-base-300/60 p-4">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-3">
          {{ t('ext.ka.settings.integrationsTitle', 'Integraciones') }}
        </h2>
        <div class="flex flex-wrap gap-3">
          <!-- Tavily: remote MCP, key-in-URL -->
          <div class="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3">
            <div class="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Globe :size="18" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-semibold leading-tight">Tavily</h3>
              <p class="text-xs text-base-content/50 leading-tight">
                {{ t('ext.ka.settings.tavilyDesc', 'Búsqueda web en tiempo real (search, extract, crawl)') }}
              </p>
            </div>
            <button class="btn btn-xs btn-primary gap-1 ml-2 shrink-0" @click="openTavilyModal">
              <Plus :size="12" />
              {{ t('ext.ka.settings.integrationsAdd', 'Agregar') }}
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg" />
        </div>
        <div
          v-else-if="!servers?.length"
          class="flex flex-col items-center justify-center py-14 text-center gap-2"
        >
          <Plug :size="28" class="text-base-content/30" />
          <p class="text-base-content/50">{{ t('ext.ka.settings.noMcpServers') }}</p>
          <button class="btn btn-sm btn-primary gap-1.5 mt-2" @click="openCreateModal">
            <Plus :size="14" />
            {{ t('ext.ka.settings.newMcpServer') }}
          </button>
        </div>
        <div v-else class="grid gap-3">
          <article
            v-for="s in servers"
            :key="s.id"
            class="card bg-base-100 shadow-sm border border-base-300 p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ s.name }}</h3>
              <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                <span class="badge badge-sm badge-outline">{{ s.transport }}</span>
                <code class="bg-base-200 px-1.5 py-0.5 rounded truncate max-w-xs text-[10px]" :title="s.url">{{ s.url }}</code>
                <span v-if="s.headers && Object.keys(s.headers).length > 0" class="badge badge-sm badge-ghost">
                  {{ Object.keys(s.headers).length }} {{ t('ext.ka.settings.headersBadge', 'headers') }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <FormSwitch
                :model-value="s.enabled"
                :label="t('ext.ka.settings.fieldEnabled')"
                @update:model-value="toggleEnabled(s)"
              />
              <button
                class="btn btn-xs btn-ghost gap-1"
                :aria-label="t('ext.ka.settings.edit')"
                @click="openEditModal(s)"
              >
                <Pencil :size="12" />
                {{ t('ext.ka.settings.edit') }}
              </button>
              <button
                class="btn btn-xs btn-ghost text-error gap-1"
                :disabled="deleteMutation.isPending.value"
                :aria-label="t('ext.ka.settings.delete')"
                @click="askDelete(s)"
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
      :title="isEditing ? t('ext.ka.settings.editMcpServer') : t('ext.ka.settings.newMcpServer')"
      :loading="saveMutation.isPending.value"
      :submit-label="isEditing ? t('ext.ka.settings.update') : t('ext.ka.settings.create')"
      @submit="onSubmit"
    >
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
        required
      />
      <FormInput
        v-model="form.apiKeyRef"
        :label="t('ext.ka.settings.fieldApiKeyRef')"
        placeholder="MCP_API_KEY"
        :description="t('ext.ka.settings.apiKeyRefOptional')"
      />

      <!-- Headers only make sense for http transport -->
      <div v-if="form.transport === 'http'">
        <label class="block text-sm font-medium mb-1 text-base-content/70">
          {{ t('ext.ka.settings.headersLabel', 'HTTP headers (optional)') }}
        </label>
        <KeyValueEditor
          v-model="form.headers"
          value-type="string"
          :label="t('ext.ka.settings.headersLabel', 'HTTP headers (optional)')"
        />
        <p class="text-xs text-base-content/50 mt-1">
          {{ t('ext.ka.settings.headersDescription', 'Sent with every request to this MCP server — e.g. X-Tenant-Id for gateway routing.') }}
        </p>
        <p class="text-xs text-base-content/40 mt-0.5">
          {{ t('ext.ka.settings.headersExample', 'Example: key "Authorization", value "Bearer xxx"') }}
        </p>
      </div>
    </KaFormModal>

    <!-- Delete confirmation -->
    <dialog ref="deleteDialogRef" class="modal">
      <div class="modal-box max-w-sm">
        <h3 class="font-semibold text-base mb-1">
          {{ t('ext.ka.settings.deleteMcpTitle', 'Delete MCP server?') }}
        </h3>
        <p class="text-sm text-base-content/70">
          {{
            t('ext.ka.settings.deleteMcpBody', '"{name}" will be permanently deleted.')
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

    <!-- Tavily integration modal: paste key → done -->
    <KaFormModal
      v-model="tavilyModalOpen"
      :title="t('ext.ka.settings.tavilyTitle', 'Conectar Tavily')"
      :loading="addTavilyMutation.isPending.value"
      :submit-label="t('ext.ka.settings.tavilyConnect', 'Conectar')"
      @submit="submitTavily"
    >
      <div v-if="tavilyConnected" class="alert alert-success text-sm">
        <span>{{ t('ext.ka.settings.tavilyAlready', 'Tavily ya está conectado.') }}</span>
      </div>
      <p class="text-sm text-base-content/70">
        {{ t('ext.ka.settings.tavilyHelp', 'Pegá tu API key de Tavily (empieza con tvly-). Se agregará como servidor MCP remoto con search, extract, crawl, map y research.') }}
      </p>
      <FormInput
        v-model="tavilyKey"
        :label="t('ext.ka.settings.fieldApiKey', 'API key')"
        placeholder="tvly-dev-…"
        required
      />
      <p class="text-xs text-base-content/40">
        {{ t('ext.ka.settings.tavilyKeyHint', 'Obtenela en app.tavily.com — se guarda en la URL del servidor MCP.') }}
      </p>
    </KaFormModal>
  </ConfigLayout>
</template>
