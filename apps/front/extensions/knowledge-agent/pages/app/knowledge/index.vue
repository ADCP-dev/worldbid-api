<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { toast } from 'vue-sonner';
import { FileText, Network, PanelLeft, Plus, Columns2, Trash2 } from 'lucide-vue-next';
import { useKnowledgeStore } from '@ka/stores/knowledge.store';
import {
  useNotesQuery,
  useNoteQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '@ka/composables/useKnowledge';
import type { Note } from '@ka/composables/useKnowledge';
import KnowledgeSidebar from '@ka/components/KnowledgeSidebar.vue';
import KnowledgeGraph from '@ka/components/KnowledgeGraph.vue';
import NoteEditor from '@ka/components/NoteEditor.vue';
import BacklinksPanel from '@ka/components/BacklinksPanel.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
  title: 'ext.ka.notes.title',
});

const { t } = useI18n();
const store = useKnowledgeStore();
const { selectedId, view, searchQuery, sidebarOpen } = storeToRefs(store);
const queryClient = useQueryClient();

// ── Data (TanStack Query) ────────────────────────────────────────────────
const notesParams = computed(() => ({
  search: searchQuery.value || undefined,
}));
const { data: notes, isPending: notesLoading } = useNotesQuery(notesParams);
const { data: currentNote, isPending: noteLoading } = useNoteQuery(selectedId);

const createMutation = useCreateNoteMutation();
const updateMutation = useUpdateNoteMutation();
const deleteMutation = useDeleteNoteMutation();

// ── Categories extracted from notes (for the category select in editor) ─
const categories = computed<string[]>(() => {
  const set = new Set<string>();
  for (const n of notes.value ?? []) {
    if (n.categoryPath) set.add(n.categoryPath);
  }
  return [...set].sort();
});

// ── Editor local state (synced from currentNote) ─────────────────────────
const title = ref('');
const contentMd = ref('');
const categoryPath = ref('');
const tags = ref<string[]>([]);
const dirty = ref(false);
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle');

watch(currentNote, (note) => {
  if (note) {
    title.value = note.title;
    contentMd.value = note.contentMd;
    categoryPath.value = note.categoryPath ?? '';
    tags.value = [...note.tags];
    dirty.value = false;
  }
});

// ── Auto-save (debounced 1.5s) ───────────────────────────────────────────
// Manual timer instead of useDebounceFn: VueUse 13 returns a plain function
// with no .cancel(), so flushing the pending save crashed with
// "doSave.cancel is not a function".
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function runSave(): Promise<void> {
  if (!selectedId.value || !dirty.value) return;
  saveStatus.value = 'saving';
  try {
    await updateMutation.mutateAsync({
      id: selectedId.value,
      data: {
        title: title.value,
        contentMd: contentMd.value,
        categoryPath: categoryPath.value || undefined,
        tags: tags.value,
      },
    });
    dirty.value = false;
    saveStatus.value = 'saved';
    setTimeout(() => {
      if (saveStatus.value === 'saved') saveStatus.value = 'idle';
    }, 2000);
  } catch {
    saveStatus.value = 'idle';
    toast.error(t('ext.ka.notes.saveError'));
  }
}

function doSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void runSave();
  }, 1500);
}

watch([title, contentMd, categoryPath, tags], () => {
  if (currentNote.value) {
    dirty.value = true;
    saveStatus.value = 'idle';
    void doSave();
  }
});

// ── Handlers ─────────────────────────────────────────────────────────────
function onSelectNote(note: Note) {
  store.selectNote(note.id);
  store.closeSidebar();
}

function onSelectBacklink(note: Note) {
  store.selectNote(note.id);
  store.closeSidebar();
}

function onCreateCategory(name: string): void {
  categoryPath.value = name;
}

/* ── Folder CRUD (rename / delete via backend API) ───────────────────── */
async function onRenameFolder(oldPath: string): Promise<void> {
  const newPath = prompt(t('ext.ka.notes.renameFolderPrompt', 'New name for: {path}').replace('{path}', oldPath), oldPath);
  if (!newPath || newPath === oldPath) return;
  try {
    await $fetch(`${useRuntimeConfig().public.apiUrl}${useRuntimeConfig().public.apiPrefix || '/api/v1'}/ka/notes/categories/rename`, {
      method: 'PATCH',
      body: { oldPath, newPath },
      headers: useAuthStore().token ? { Authorization: `Bearer ${useAuthStore().token}` } : {},
    });
    queryClient.invalidateQueries({ queryKey: ['ka-notes'] });
    queryClient.invalidateQueries({ queryKey: ['ka-graph'] });
    toast.success(t('ext.ka.notes.folderRenamed', 'Folder renamed'));
  } catch {
    toast.error(t('ext.ka.notes.folderRenameError', 'Could not rename folder'));
  }
}

async function onDeleteFolder(path: string): Promise<void> {
  if (!confirm(t('ext.ka.notes.deleteFolderConfirm', 'Delete folder? Notes will be moved to uncategorized.'))) return;
  try {
    await $fetch(`${useRuntimeConfig().public.apiUrl}${useRuntimeConfig().public.apiPrefix || '/api/v1'}/ka/notes/categories/${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: useAuthStore().token ? { Authorization: `Bearer ${useAuthStore().token}` } : {},
    });
    queryClient.invalidateQueries({ queryKey: ['ka-notes'] });
    queryClient.invalidateQueries({ queryKey: ['ka-graph'] });
    toast.success(t('ext.ka.notes.folderDeleted', 'Folder deleted'));
  } catch {
    toast.error(t('ext.ka.notes.folderDeleteError', 'Could not delete folder'));
  }
}

function onGraphSelect(id: string) {
  store.selectNote(id);
  // From graph nodes → always go to split so the user sees both.
  store.openSplit();
}

function onGraphNew() {
  void createNew();
}

async function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await runSave();
}

async function createNew() {
  try {
    const note = await createMutation.mutateAsync({
      title: t('ext.ka.notes.untitled'),
      contentMd: '<p></p>',
    });
    store.selectNote(note.id);
    store.closeSidebar();
  } catch {
    toast.error(t('ext.ka.notes.createError'));
  }
}

async function removeNote() {
  if (!selectedId.value) return;
  if (!confirm(t('ext.ka.notes.deleteConfirm'))) return;
  try {
    await deleteMutation.mutateAsync(selectedId.value);
    store.selectNote(null);
    store.setBacklinks(false);
    store.openGraph();
    toast.success(t('ext.ka.notes.deleted'));
  } catch {
    toast.error(t('ext.ka.notes.deleteError'));
  }
}

function onSearch(q: string) {
  store.setSearch(q);
}

const saveLabel = computed(() => {
  if (saveStatus.value === 'saving') return t('ext.ka.notes.saving');
  if (saveStatus.value === 'saved') return t('ext.ka.notes.saved');
  if (dirty.value) return t('ext.ka.notes.unsaved');
  return '';
});
</script>

<template>
  <div class="-m-4 flex h-[calc(100vh-45px-3rem)] overflow-hidden bg-base-200">
    <!-- Mobile sidebar toggle -->
    <button
      class="btn btn-sm btn-ghost btn-circle absolute left-2 top-2 z-30 lg:hidden"
      :class="{ 'opacity-0 pointer-events-none': sidebarOpen }"
      @click="store.toggleSidebar()"
    >
      <PanelLeft class="w-4 h-4" />
    </button>

    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-30 lg:hidden"
      @click="store.closeSidebar()"
    />

    <!-- Left sidebar -->
    <aside
      class="w-[280px] shrink-0 z-40 transition-transform duration-200 fixed lg:static inset-y-0 left-0 lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <KnowledgeSidebar
        :notes="notes ?? []"
        :selected-id="selectedId"
        :search-query="searchQuery"
        :loading="notesLoading"
        @select="onSelectNote"
        @new="createNew"
        @search="onSearch"
        @rename-folder="onRenameFolder"
        @delete-folder="onDeleteFolder"
      />
    </aside>

    <!-- Right panel -->
    <main class="flex-1 flex flex-col min-w-0 bg-base-100">
      <!-- Top bar: view toggle + actions -->
      <div class="flex items-center justify-between border-b border-base-300 px-4 h-12 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-medium truncate text-base-content/70">
            {{ currentNote?.title ?? t('ext.ka.graph.title') }}
          </span>
          <span
            v-if="view === 'editor' && saveLabel"
            class="badge badge-xs badge-ghost gap-1"
          >
            <span
              class="inline-block w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-warning': dirty,
                'bg-info animate-pulse': saveStatus === 'saving',
                'bg-success': saveStatus === 'saved',
              }"
            />
            {{ saveLabel }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- View toggle: 3 modes — always enabled -->
          <div role="tablist" class="tabs tabs-boxed tabs-sm">
            <button
              role="tab"
              class="tab gap-1"
              :class="{ 'tab-active': view === 'editor' }"
              @click="store.openEditor()"
            >
              <FileText class="w-3.5 h-3.5" />
              {{ t('ext.ka.notes.editorTab') }}
            </button>
            <button
              role="tab"
              class="tab gap-1"
              :class="{ 'tab-active': view === 'split' }"
              :disabled="!selectedId"
              @click="store.openSplit()"
            >
              <Columns2 class="w-3.5 h-3.5" />
              {{ t('ext.ka.notes.splitTab', 'Split') }}
            </button>
            <button
              role="tab"
              class="tab gap-1"
              :class="{ 'tab-active': view === 'graph' }"
              @click="store.openGraph()"
            >
              <Network class="w-3.5 h-3.5" />
              {{ t('ext.ka.graph.title') }}
            </button>
          </div>

          <button
            v-if="(view === 'editor' || view === 'split') && selectedId"
            class="btn btn-sm btn-ghost text-error gap-1"
            @click="removeNote"
          >
            <Trash2 class="w-3.5 h-3.5" />
            {{ t('ext.ka.notes.delete') }}
          </button>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 min-h-0 flex overflow-hidden">
        <!-- Editor (shown in 'editor' and 'split' views) -->
        <div
          v-if="(view === 'editor' || view === 'split') && selectedId"
          class="flex-1 min-w-0 relative flex flex-col gap-3"
        >
          <div v-if="noteLoading" class="flex justify-center py-12">
            <span class="loading loading-spinner loading-md" />
          </div>
          <div
            v-else-if="!currentNote"
            class="flex flex-col items-center justify-center h-full text-base-content/40"
          >
            <FileText class="w-10 h-10 mb-2 opacity-50" />
            <p>{{ t('ext.ka.notes.notFound') }}</p>
          </div>
          <div v-else class="p-4 flex-1 overflow-auto flex flex-col gap-3">
            <NoteEditor
              v-model="contentMd"
              :title="title"
              :category-path="categoryPath"
              :tags="tags"
              :categories="categories"
              @update:title="title = $event"
              @update:category-path="categoryPath = $event"
              @update:tags="tags = $event"
              @create-category="onCreateCategory"
              @save="flushSave"
            />
            <!-- Backlinks below the editor -->
            <BacklinksPanel
              v-if="selectedId"
              :note-id="selectedId"
              :embedded="true"
              @select="onSelectBacklink"
            />
          </div>
        </div>

        <!-- Graph (shown in 'graph' and 'split' views) -->
        <div
          v-if="view === 'graph' || (view === 'split' && selectedId)"
          class="flex-1 min-w-0 relative"
        >
          <KnowledgeGraph
            @select="onGraphSelect"
            @new="onGraphNew"
          />
        </div>

        <!-- Empty state (editor view, nothing selected) -->
        <div
          v-else-if="view === 'editor' && !selectedId"
          class="flex-1 flex flex-col items-center justify-center text-base-content/40 gap-3"
        >
          <FileText class="w-12 h-12 opacity-40" />
          <p class="text-lg">{{ t('ext.ka.notes.selectPrompt') }}</p>
          <button class="btn btn-sm btn-primary gap-2" @click="createNew">
            <Plus class="w-4 h-4" />
            {{ t('ext.ka.notes.create') }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>