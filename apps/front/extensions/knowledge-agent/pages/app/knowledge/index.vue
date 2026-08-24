<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useKnowledgeStore } from '@ka/stores/knowledge.store';
import type { Note } from '@ka/composables/useKnowledge';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const store = useKnowledgeStore();
const searchQuery = ref('');
const selectedNote = ref<Note | null>(null);

onMounted(async () => {
  await store.loadNotes();
});

async function onSearch() {
  await store.loadNotes({ search: searchQuery.value || undefined });
}

function selectNote(note: Note) {
  selectedNote.value = note;
  navigateTo(`/app/knowledge/${note.id}`);
}

async function createNew() {
  const note = await store.saveNote({
    title: 'Untitled Note',
    contentMd: '<p></p>',
  });
  navigateTo(`/app/knowledge/${note.id}`);
}
</script>

<template>
  <div class="flex h-full">
    <!-- Tree sidebar -->
    <aside class="w-64 border-r bg-base-200 flex flex-col">
      <div class="p-3 border-b">
        <h2 class="text-sm font-semibold uppercase text-base-content/60">Knowledge Base</h2>
      </div>
      <div class="p-2 border-b">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search notes..."
          class="input input-bordered input-sm w-full"
          @keyup.enter="onSearch"
        >
      </div>
      <div class="p-2 border-b flex gap-2">
        <button class="btn btn-sm btn-primary flex-1" @click="createNew">
          + New Note
        </button>
        <NuxtLink
          to="/app/knowledge/graph"
          class="btn btn-sm btn-ghost flex-1 border"
          title="Open graph view"
        >
          Graph
        </NuxtLink>
      </div>
      <div class="flex-1 overflow-auto">
        <KnowledgeTree
          :notes="store.notes"
          :selected-id="selectedNote?.id"
          @select="selectNote"
        />
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto p-6">
      <div v-if="store.loading && store.notes.length === 0" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"/>
      </div>
      <div v-else-if="store.notes.length === 0" class="text-center py-12 text-base-content/50">
        <p class="text-lg mb-2">No notes found</p>
        <button class="btn btn-primary btn-sm" @click="createNew">Create your first note</button>
      </div>
      <div v-else class="space-y-4">
        <h1 class="text-2xl font-bold">Notes ({{ store.notes.length }})</h1>
        <div class="grid gap-3">
          <NuxtLink
            v-for="note in store.notes"
            :key="note.id"
            :to="`/app/knowledge/${note.id}`"
            class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow p-4 border"
          >
            <h3 class="font-semibold">{{ note.title }}</h3>
            <p class="text-sm text-base-content/60 truncate">
              {{ note.contentMd.replace(/<[^>]+>/g, '').slice(0, 100) }}
            </p>
            <div v-if="note.categoryPath" class="mt-2">
              <span class="badge badge-xs badge-ghost">{{ note.categoryPath }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>