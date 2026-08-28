<script setup lang="ts">
/**
 * AgentChatLayout — the 2-column split-view shell used by both `/app/agent`
 * (no session) and `/app/agent/[sessionId]` (session active). Contains all
 * chat logic; the page files only wire Nuxt route matching.
 */
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  useChatSessions,
  type ChatSession,
} from '@ka/composables/useChatStream';
import { useAgentConfig } from '@ka/composables/useAgentConfig';
import ChatSessionList from '@ka/components/ChatSessionList.vue';
import ChatStream from '@ka/components/ChatStream.vue';

const { t } = useI18n();
const route = useRoute();

// ── Agent configs (for the header selector) ──────────────────────────────
const { getAgentConfigs } = useAgentConfig();
const { data: agentConfigs } = useQuery({
  queryKey: ['ka-agent-configs'],
  queryFn: getAgentConfigs,
});
const agentOptions = computed(() =>
  (agentConfigs.value ?? []).map((c) => ({
    label: `${c.name} (${c.provider}:${c.model.split(':').pop()})`,
    value: c.id,
  })),
);
/** Currently selected agent config id for the active session. */
const selectedAgentConfigId = ref<string | null>(null);

/** Model string of the active agent config, e.g. "openrouter:z-ai/glm-5.3-flash". */
const activeAgentModel = computed<string | null>(
  () => agentConfigs.value?.find((c) => c.id === selectedAgentConfigId.value)?.model ?? null,
);

const {
  sessions,
  loading,
  getSession,
  createMutation,
  updateMutation,
  deleteMutation,
} = useChatSessions();

const activeSessionId = computed<string | null>(() => {
  const raw = route.params.sessionId;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === 'string' ? raw : null;
});

const activeSession = ref<ChatSession | null>(null);
const loadingSession = ref(false);

// Sync selected agent config from active session
watch(activeSession, (s) => {
  selectedAgentConfigId.value = s?.agentConfigId ?? null;
});

// Update session when agent config changes
watch(selectedAgentConfigId, (newId) => {
  if (!newId || !activeSessionId.value || newId === activeSession.value?.agentConfigId) return;
  void updateMutation.mutateAsync({
    id: activeSessionId.value,
    payload: { agentConfigId: newId },
  });
});

watch(
  activeSessionId,
  async (id) => {
    activeSession.value = null;
    if (!id) return;
    loadingSession.value = true;
    try {
      activeSession.value = await getSession(id);
    } catch {
      activeSession.value = null;
    } finally {
      loadingSession.value = false;
    }
  },
  { immediate: true },
);

const editing = ref(false);
const titleBuffer = ref('');
const savingTitle = ref(false);

function startEdit() {
  if (!activeSession.value) return;
  titleBuffer.value = activeSession.value.title;
  editing.value = true;
}

async function saveTitle() {
  if (!activeSessionId.value || !activeSession.value) return;
  savingTitle.value = true;
  try {
    await updateMutation.mutateAsync({
      id: activeSessionId.value,
      payload: { title: titleBuffer.value },
    });
    activeSession.value = { ...activeSession.value, title: titleBuffer.value };
    editing.value = false;
  } finally {
    savingTitle.value = false;
  }
}

const creating = ref(false);

async function newChat() {
  creating.value = true;
  try {
    // Default to the first agent config if none specified.
    const defaultConfigId = agentConfigs.value?.[0]?.id;
    const session = await createMutation.mutateAsync({
      title: 'New Chat',
      agentConfigId: defaultConfigId,
    });
    await navigateTo(`/app/agent/${session.id}`);
  } finally {
    creating.value = false;
  }
}

function onSelect(id: string) {
  void navigateTo(`/app/agent/${id}`);
}

async function onDelete(id: string) {
  if (!confirm(t('ext.ka.chat.deleteConfirm'))) return;
  await deleteMutation.mutateAsync(id);
  if (activeSessionId.value === id) {
    await navigateTo('/app/agent');
  }
}

const sidebarOpen = ref(false);

const sessionsList = computed<ChatSession[]>(() => sessions.value ?? []);
</script>

<template>
  <div class="-mx-4 -my-6 flex h-[calc(100vh-45px)]">
    <div class="hidden lg:block w-[260px] shrink-0">
      <ChatSessionList
        :sessions="sessionsList"
        :active-id="activeSessionId"
        :loading="loading"
        @select="onSelect"
        @delete="onDelete"
        @new="newChat"
      />
    </div>

    <div class="lg:hidden drawer drawer-end w-full">
      <input
        id="ka-chat-drawer"
        v-model="sidebarOpen"
        type="checkbox"
        class="drawer-toggle"
      >
      <div class="drawer-content flex flex-col h-full">
        <div class="flex items-center gap-2 p-2 border-b border-base-300 bg-base-100">
          <label for="ka-chat-drawer" class="btn btn-ghost btn-sm btn-square">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          <span class="font-semibold truncate">
            {{ activeSession?.title ?? t('ext.ka.chat.title') }}
          </span>
        </div>
        <div v-if="activeSessionId" class="flex-1 overflow-hidden">
          <ChatStream :session-id="activeSessionId" :agent-model="activeAgentModel" />
        </div>
        <div v-else class="flex-1 flex items-center justify-center text-base-content/50 px-4">
          <div class="text-center">
            <p class="text-lg mb-2">{{ t('ext.ka.chat.emptyStateTitle') }}</p>
            <p class="text-sm">{{ t('ext.ka.chat.emptyStateSubtitle') }}</p>
          </div>
        </div>
      </div>
      <div class="drawer-side z-50">
        <label for="ka-chat-drawer" class="drawer-overlay" />
        <div class="w-[280px] h-full">
          <ChatSessionList
            :sessions="sessionsList"
            :active-id="activeSessionId"
            :loading="loading"
            @select="(id) => { onSelect(id); sidebarOpen = false; }"
            @delete="onDelete"
            @new="() => { newChat(); sidebarOpen = false; }"
          />
        </div>
      </div>
    </div>

    <div class="hidden lg:flex flex-1 flex-col min-w-0">
      <div
        v-if="activeSessionId"
        class="flex items-center justify-between gap-2 px-4 py-2 border-b border-base-300 bg-base-100"
      >
        <template v-if="editing">
          <input
            v-model="titleBuffer"
            class="input input-sm input-bordered flex-1 max-w-md"
            @keyup.enter="saveTitle"
            @keyup.escape="editing = false"
          >
          <button
            class="btn btn-xs btn-primary"
            :disabled="savingTitle"
            @click="saveTitle"
          >{{ t('ext.ka.chat.save') }}</button>
          <button class="btn btn-xs btn-ghost" @click="editing = false">{{ t('ext.ka.chat.cancel') }}</button>
        </template>
        <template v-else>
          <span class="font-semibold truncate">
            {{ activeSession?.title ?? (loadingSession ? t('ext.ka.chat.loading') : t('ext.ka.chat.notFound')) }}
          </span>
          <!-- Agent config selector -->
          <select
            v-if="agentOptions.length > 0"
            v-model="selectedAgentConfigId"
            class="select select-xs select-bordered max-w-[260px] ml-2"
            :aria-label="t('ext.ka.settings.agents')"
          >
            <option v-for="opt in agentOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div class="flex items-center gap-1">
            <button
              v-if="activeSession"
              class="btn btn-xs btn-ghost"
              @click="startEdit"
            >{{ t('ext.ka.chat.edit') }}</button>
            <button
              v-if="activeSession"
              class="btn btn-xs btn-ghost text-error"
              @click="onDelete(activeSessionId!)"
            >{{ t('ext.ka.chat.deleteSession') }}</button>
          </div>
        </template>
      </div>

      <div v-if="activeSessionId" class="flex-1 overflow-hidden">
        <ChatStream :session-id="activeSessionId" :agent-model="activeAgentModel" />
      </div>
      <div v-else class="flex-1 flex items-center justify-center text-base-content/50">
        <div class="text-center">
          <p class="text-lg mb-2">{{ t('ext.ka.chat.emptyStateTitle') }}</p>
          <p class="text-sm">{{ t('ext.ka.chat.emptyStateSubtitle') }}</p>
          <button class="btn btn-primary btn-sm mt-4" :disabled="creating" @click="newChat">
            <span v-if="creating" class="loading loading-xs" />
            {{ t('ext.ka.chat.new') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>