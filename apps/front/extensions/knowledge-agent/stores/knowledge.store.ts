import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useKnowledge } from '../composables/useKnowledge';
import type { Note, QueryNotesParams } from '../composables/useKnowledge';

export const useKnowledgeStore = defineStore('knowledge', () => {
  const notes = ref<Note[]>([]);
  const currentNote = ref<Note | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { getNotes, getNote, createNote, updateNote, deleteNote } =
    useKnowledge();

  async function loadNotes(params: QueryNotesParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      notes.value = await getNotes(params);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadNote(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentNote.value = await getNote(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function saveNote(
    payload: { title: string; contentMd: string; categoryPath?: string },
  ) {
    const created = await createNote(payload);
    notes.value.unshift(created);
    return created;
  }

  async function patchNote(id: string, payload: Partial<Note>) {
    const updated = await updateNote(id, payload);
    const idx = notes.value.findIndex((n) => n.id === id);
    if (idx >= 0) notes.value[idx] = updated;
    if (currentNote.value?.id === id) currentNote.value = updated;
    return updated;
  }

  async function removeNote(id: string) {
    await deleteNote(id);
    notes.value = notes.value.filter((n) => n.id !== id);
    if (currentNote.value?.id === id) currentNote.value = null;
  }

  return {
    notes,
    currentNote,
    loading,
    error,
    loadNotes,
    loadNote,
    saveNote,
    patchNote,
    removeNote,
  };
});