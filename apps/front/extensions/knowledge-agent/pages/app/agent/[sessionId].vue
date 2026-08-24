<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useChatSessions, type ChatSession } from '@ka/composables/useChatStream';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
  title: 'Chat',
});

const route = useRoute();
const sessionId = route.params.sessionId as string;

const { getSession, updateSession, deleteSession } = useChatSessions();

const session = ref<ChatSession | null>(null);
const loading = ref(true);
const editing = ref(false);
const titleBuffer = ref('');
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    session.value = await getSession(sessionId);
    if (session.value) titleBuffer.value = session.value.title;
  } catch (e) {
    console.error('Failed to load session:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function startEdit() {
  if (!session.value) return;
  titleBuffer.value = session.value.title;
  editing.value = true;
}

async function saveTitle() {
  if (!session.value) return;
  saving.value = true;
  try {
    session.value = await updateSession(sessionId, { title: titleBuffer.value });
    editing.value = false;
  } catch (e) {
    console.error('Failed to update title:', e);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  const { t } = useI18n();
  if (!confirm(t('ext.ka.chat.deleteConfirm'))) return;
  try {
    await deleteSession(sessionId);
    navigateTo('/app/agent');
  } catch (e) {
    console.error('Failed to delete session:', e);
  }
}

function goBack() {
  navigateTo('/app/agent');
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Navbar -->
    <div class="navbar bg-base-200 border-b">
      <div class="navbar-start">
        <button class="btn btn-ghost btn-sm" @click="goBack">← Back</button>
      </div>
      <div class="navbar-center flex items-center gap-2">
        <template v-if="editing">
          <input
            v-model="titleBuffer"
            class="input input-sm input-bordered"
            @keyup.enter="saveTitle"
            @keyup.escape="editing = false"
          >
          <button
            class="btn btn-xs btn-primary"
            :disabled="saving"
            @click="saveTitle"
          >Save</button>
          <button class="btn btn-xs btn-ghost" @click="editing = false">Cancel</button>
        </template>
        <template v-else>
          <span class="font-semibold">{{ session?.title ?? 'Loading...' }}</span>
          <button
            v-if="session"
            class="btn btn-xs btn-ghost"
            @click="startEdit"
          >Edit</button>
        </template>
      </div>
      <div class="navbar-end">
        <button
          v-if="session"
          class="btn btn-xs btn-ghost text-error"
          @click="remove"
        >Delete</button>
      </div>
    </div>

    <!-- Chat -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"/>
    </div>
    <div v-else-if="!session" class="flex-1 flex items-center justify-center text-base-content/50">
      <p>Session not found or you don't have access.</p>
    </div>
    <div v-else class="flex-1 overflow-hidden">
      <ChatStream :session-id="sessionId" />
    </div>
  </div>
</template>