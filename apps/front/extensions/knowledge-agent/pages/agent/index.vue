<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useChatSessions, type ChatSession } from '../composables/useChatStream';

definePageMeta({
  layout: 'app',
  title: 'Chat Sessions',
});

const { getSessions, createSession, deleteSession } = useChatSessions();

const sessions = ref<ChatSession[]>([]);
const loading = ref(true);
const creating = ref(false);

async function load() {
  loading.value = true;
  try {
    sessions.value = await getSessions();
  } catch (e) {
    console.error('Failed to load sessions:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function newSession() {
  creating.value = true;
  try {
    const session = await createSession({ title: 'New Chat' });
    navigateTo(`/agent/${session.id}`);
  } catch (e) {
    console.error('Failed to create session:', e);
  } finally {
    creating.value = false;
  }
}

async function remove(id: string) {
  try {
    await deleteSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
  } catch (e) {
    console.error('Failed to delete session:', e);
  }
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Agent Chat</h1>
        <p class="text-base-content/60 text-sm">
          Per-user chat sessions with the knowledge agent.
        </p>
      </div>
      <button
        class="btn btn-primary btn-sm"
        :disabled="creating"
        @click="newSession"
      >
        <span v-if="creating" class="loading loading-xs"></span>
        + New Chat
      </button>
    </header>

    <section>
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="sessions.length === 0" class="text-center py-12 text-base-content/50">
        <p class="text-lg mb-2">No chat sessions yet</p>
        <button class="btn btn-primary btn-sm" @click="newSession">Start your first chat</button>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Title</th>
              <th>Created</th>
              <th>Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sessions" :key="s.id" class="hover cursor-pointer" @click="navigateTo(`/agent/${s.id}`)">
              <td class="font-medium">{{ s.title }}</td>
              <td class="text-xs text-base-content/60">
                {{ new Date(s.createdAt).toLocaleString() }}
              </td>
              <td class="text-xs text-base-content/60">
                {{ new Date(s.updatedAt).toLocaleString() }}
              </td>
              <td class="text-right" @click.stop>
                <button class="btn btn-xs btn-ghost" @click="navigateTo(`/agent/${s.id}`)">
                  Open
                </button>
                <button
                  class="btn btn-xs btn-ghost text-error"
                  @click="remove(s.id)"
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