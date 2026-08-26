<script setup lang="ts">
import { Plus, FolderTree } from 'lucide-vue-next'
import type { Note } from '../composables/useKnowledge'
import KnowledgeTree from './KnowledgeTree.vue'

const props = defineProps<{
  notes: Note[]
  selectedId: string | null
  searchQuery: string
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [note: Note]
  new: []
  search: [query: string]
}>()

function onSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  emit('search', target?.value ?? '')
}
</script>

<template>
  <div class="flex flex-col h-full bg-base-200 border-r border-base-300">
    <!-- Header -->
    <div class="p-3 border-b border-base-300">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">
        {{ $t('ext.ka.notes.title') }}
      </h2>
    </div>

    <!-- Search -->
    <div class="p-3 border-b border-base-300">
      <label class="input input-sm input-bordered flex items-center gap-2 w-full">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-4 h-4 opacity-60 shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          :value="props.searchQuery"
          type="text"
          :placeholder="$t('ext.ka.notes.search')"
          class="grow bg-transparent outline-none"
          @input="onSearchInput"
        >
      </label>
    </div>

    <!-- Actions -->
    <div class="p-3 border-b border-base-300">
      <button
        class="btn btn-sm btn-primary w-full gap-2"
        @click="emit('new')"
      >
        <Plus class="w-4 h-4" />
        {{ $t('ext.ka.notes.create') }}
      </button>
    </div>

    <!-- Tree -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-if="loading && props.notes.length === 0"
        class="flex justify-center py-8"
      >
        <span class="loading loading-spinner loading-sm" />
      </div>
      <div
        v-else-if="props.notes.length === 0"
        class="flex flex-col items-center justify-center py-8 text-base-content/40 px-4 text-center"
      >
        <FolderTree class="w-6 h-6 mb-2 opacity-50" />
        <p class="text-sm">{{ $t('ext.ka.notes.empty') }}</p>
      </div>
      <KnowledgeTree
        v-else
        :notes="props.notes"
        :selected-id="props.selectedId"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>