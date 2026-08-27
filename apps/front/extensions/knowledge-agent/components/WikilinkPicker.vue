<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Search, FileText, X } from 'lucide-vue-next';
import { useNotesQuery } from '../composables/useKnowledge';
import type { Note } from '../composables/useKnowledge';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  select: [note: Note];
  close: [];
}>();

const { t } = useI18n();

const search = ref('');
const searchParams = computed(() => ({
  search: search.value || undefined,
}));
const { data: notes, isPending } = useNotesQuery(searchParams);

const filtered = computed<Note[]>(() => {
  const all = notes.value ?? [];
  const q = search.value.trim().toLowerCase();
  if (!q) return all.slice(0, 30);
  return all.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 30);
});

watch(() => props.open, (open) => {
  if (open) search.value = '';
});

function selectNote(note: Note): void {
  emit('select', note);
  emit('close');
}
</script>

<template>
  <div
    v-if="open"
    class="ka-wikilink-picker absolute z-50 top-full left-0 mt-1 w-80 max-h-64 bg-base-100 border border-base-300 rounded-lg shadow-xl flex flex-col"
    @click.stop
  >
    <div class="flex items-center gap-2 p-2 border-b border-base-300">
      <Search :size="14" class="text-base-content/40 shrink-0" />
      <input
        v-model="search"
        type="text"
        :placeholder="t('ext.ka.notes.searchNotesLink', 'Search note to link…')"
        class="flex-1 bg-transparent outline-none text-sm"
        autofocus
      >
      <button
        type="button"
        class="btn btn-xs btn-ghost btn-circle"
        :aria-label="t('ext.ka.notes.closePicker', 'Close')"
        @click="emit('close')"
      >
        <X :size="13" />
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-1">
      <div v-if="isPending" class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm" />
      </div>
      <div v-else-if="filtered.length === 0" class="text-center py-4 text-xs text-base-content/40">
        {{ t('ext.ka.notes.noNotesFound', 'No notes found') }}
      </div>
      <button
        v-for="note in filtered"
        :key="note.id"
        type="button"
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-base-200 text-left transition-colors"
        @click="selectNote(note)"
      >
        <FileText :size="13" class="shrink-0 text-base-content/40" />
        <span class="truncate text-sm">{{ note.title }}</span>
        <span v-if="note.categoryPath" class="text-xs text-base-content/40 truncate ml-auto">
          {{ note.categoryPath }}
        </span>
      </button>
    </div>
  </div>
</template>