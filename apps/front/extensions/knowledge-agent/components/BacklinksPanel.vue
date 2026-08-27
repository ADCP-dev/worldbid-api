<script setup lang="ts">
import { computed } from 'vue';
import { Link2, FileText, PanelRightClose } from 'lucide-vue-next';
import { useBacklinksQuery } from '../composables/useKnowledge';
import type { Note } from '../composables/useKnowledge';

const props = defineProps<{
  noteId: string | null;
}>();

const emit = defineEmits<{
  select: [note: Note];
  close: [];
}>();

const { t } = useI18n();

const { data, isPending, isError } = useBacklinksQuery(
  computed(() => props.noteId),
);

const backlinks = computed(() => data.value ?? []);

function plainSummary(md: string, max = 140): string {
  const text = md
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
</script>

<template>
  <aside
    class="flex flex-col h-full w-[300px] shrink-0 border-l border-base-300 bg-base-200"
    :aria-label="t('ext.ka.notes.backlinksTitle', 'Backlinks')"
  >
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-base-300">
      <span class="inline-flex items-center gap-1.5 text-sm font-semibold">
        <Link2 :size="14" class="text-base-content/60" />
        {{ t('ext.ka.notes.backlinksTitle', 'Backlinks') }}
      </span>
      <button
        type="button"
        class="btn btn-xs btn-ghost btn-circle"
        :aria-label="t('ext.ka.notes.closeBacklinks', 'Close backlinks panel')"
        @click="emit('close')"
      >
        <PanelRightClose :size="14" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-2">
      <div v-if="isPending" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-sm" />
      </div>

      <div
        v-else-if="isError"
        class="text-xs text-error/80 px-2 py-3 rounded-lg bg-error/10"
      >
        {{ t('ext.ka.notes.backlinksError', 'Could not load backlinks') }}
      </div>

      <div
        v-else-if="backlinks.length === 0"
        class="text-xs text-base-content/50 px-2 py-3 italic"
      >
        {{ t('ext.ka.notes.backlinksEmpty', 'No notes link here yet.') }}
      </div>

      <button
        v-for="note in backlinks"
        :key="note.id"
        type="button"
        class="w-full text-left px-2.5 py-2 rounded-lg bg-base-100 hover:bg-base-300 border border-base-300 transition-colors group"
        @click="emit('select', note)"
      >
        <div class="flex items-center gap-1.5">
          <FileText :size="12" class="shrink-0 text-base-content/50 group-hover:text-primary" />
          <span class="text-sm font-medium truncate group-hover:text-primary">
            {{ note.title }}
          </span>
        </div>
        <p class="mt-0.5 text-xs text-base-content/50 line-clamp-2">
          {{ plainSummary(note.contentMd) }}
        </p>
      </button>
    </div>
  </aside>
</template>
