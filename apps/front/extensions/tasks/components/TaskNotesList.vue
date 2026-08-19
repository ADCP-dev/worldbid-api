<script setup lang="ts">
/**
 * TaskNotesList — list of notes attached to a task + input to add new notes.
 *
 * Features (Slice 6, change tasks-v2-professional):
 *   - Lists notes via useTasks().getTaskNotes(taskId)
 *   - Create note via useTasks().createTaskNote({ taskId, content })
 *   - Edit note inline (only for author or admin)
 *   - Delete note with confirm (only for author or admin)
 *
 * Backend enforces rowLevel: user/manager see only their own notes, admin
 * sees all. The edit/delete buttons here are a UX hint — the backend is the
 * source of truth for authorization.
 */
import { ref, computed, onMounted, watch } from 'vue';
import { toast } from 'vue-sonner';
import { Send, Pencil, Trash2, X, Check } from 'lucide-vue-next';
import type { TaskNote, UserLight, PaginatedResponse } from '../types';

const props = defineProps<{
  taskId: number;
  users: UserLight[];
}>();

const tasksApi = useTasks();
const authStore = useAuthStore();

const notes = ref<TaskNote[]>([]);
const loading = ref(false);
const newNote = ref('');
const submitting = ref(false);

// Inline edit state
const editingId = ref<number | null>(null);
const editingContent = ref('');
const savingEdit = ref(false);

// Delete confirm
const deleteTarget = ref<TaskNote | null>(null);

const userMap = computed<Record<number, UserLight>>(() => {
  const m: Record<number, UserLight> = {};
  for (const u of props.users) m[u.id] = u;
  return m;
});

const currentUserId = computed(() => {
  const id = authStore.user?.id;
  return id != null ? Number(id) : null;
});

const isAdmin = computed(() => authStore.user?.role?.name === 'admin');

function canModify(note: TaskNote): boolean {
  if (isAdmin.value) return true;
  if (currentUserId.value == null) return false;
  return note.authorId === currentUserId.value;
}

function initials(user: UserLight | undefined): string {
  if (!user) return '?';
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function loadNotes() {
  if (!props.taskId) return;
  loading.value = true;
  try {
    const res: PaginatedResponse<TaskNote> | TaskNote[] =
      await tasksApi.getTaskNotes(props.taskId, 1, 100);
    notes.value = Array.isArray(res) ? res : (res.data ?? []);
  } catch (err: unknown) {
    toast.error('Error loading notes', { description: errorMessage(err) });
  } finally {
    loading.value = false;
  }
}

async function submitNote() {
  const content = newNote.value.trim();
  if (!content || !props.taskId) return;
  submitting.value = true;
  try {
    await tasksApi.createTaskNote({ taskId: props.taskId, content });
    toast.success('Note added');
    newNote.value = '';
    await loadNotes();
  } catch (err: unknown) {
    toast.error('Failed to add note', { description: errorMessage(err) });
  } finally {
    submitting.value = false;
  }
}

function startEdit(note: TaskNote) {
  editingId.value = note.id;
  editingContent.value = note.content;
}

function cancelEdit() {
  editingId.value = null;
  editingContent.value = '';
}

async function saveEdit() {
  if (editingId.value == null) return;
  const content = editingContent.value.trim();
  if (!content) return;
  savingEdit.value = true;
  try {
    await tasksApi.updateTaskNote(editingId.value, content);
    toast.success('Note updated');
    editingId.value = null;
    editingContent.value = '';
    await loadNotes();
  } catch (err: unknown) {
    toast.error('Failed to update note', { description: errorMessage(err) });
  } finally {
    savingEdit.value = false;
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await tasksApi.deleteTaskNote(deleteTarget.value.id);
    toast.success('Note deleted');
    deleteTarget.value = null;
    await loadNotes();
  } catch (err: unknown) {
    toast.error('Failed to delete note', { description: errorMessage(err) });
  }
}

onMounted(loadNotes);
watch(() => props.taskId, loadNotes);
</script>

<template>
  <div class="space-y-4">
    <!-- Notes list -->
    <div v-if="loading" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-sm text-primary" />
    </div>

    <div
      v-else-if="notes.length === 0"
      class="text-center py-8 text-base-content/40 text-sm"
    >
      No notes yet
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="note in notes"
        :key="note.id"
        class="flex gap-3"
      >
        <div class="avatar shrink-0">
          <div class="w-8 h-8 rounded-full bg-neutral text-neutral-content text-xs flex items-center justify-center">
            {{ initials(note.authorId ? userMap[note.authorId] : undefined) }}
          </div>
        </div>
        <div class="flex-1 bg-base-200 rounded-lg p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">
              {{ note.authorId ? (userMap[note.authorId]?.firstName ?? 'User') : 'Unknown' }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-base-content/40">{{ timeAgo(note.createdAt) }}</span>
              <template v-if="canModify(note)">
                <button
                  v-if="editingId !== note.id"
                  class="btn btn-ghost btn-xs btn-circle"
                  title="Edit"
                  @click="startEdit(note)"
                >
                  <Pencil class="w-3 h-3" />
                </button>
                <button
                  class="btn btn-ghost btn-xs btn-circle text-error"
                  title="Delete"
                  @click="deleteTarget = note"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </template>
            </div>
          </div>

          <!-- View mode -->
          <p
            v-if="editingId !== note.id"
            class="text-sm text-base-content/80 mt-1 whitespace-pre-wrap"
          >{{ note.content }}</p>

          <!-- Edit mode -->
          <div v-else class="mt-2 space-y-2">
            <textarea
              v-model="editingContent"
              class="textarea textarea-bordered w-full text-sm"
              rows="3"
              :disabled="savingEdit"
            />
            <div class="flex items-center gap-2">
              <button
                class="btn btn-primary btn-sm"
                :disabled="savingEdit || !editingContent.trim()"
                @click="saveEdit"
              >
                <span v-if="savingEdit" class="loading loading-spinner loading-xs" />
                <Check v-else class="w-4 h-4" /> Save
              </button>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="savingEdit"
                @click="cancelEdit"
              >
                <X class="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <!-- New note input -->
    <div class="flex gap-2 pt-2 border-t border-base-300">
      <textarea
        v-model="newNote"
        class="textarea textarea-bordered flex-1 text-sm"
        rows="2"
        placeholder="Write a note…"
        :disabled="submitting"
        @keydown.ctrl.enter="submitNote"
      />
      <button
        class="btn btn-primary btn-sm self-end"
        :disabled="!newNote.trim() || submitting"
        @click="submitNote"
      >
        <span v-if="submitting" class="loading loading-spinner loading-xs" />
        <Send v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Delete confirm modal -->
    <dialog :class="['modal', { 'modal-open': deleteTarget }]">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Delete note?</h3>
        <p class="py-4 text-sm text-base-content/70">
          This note will be permanently deleted.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="deleteTarget = null">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>