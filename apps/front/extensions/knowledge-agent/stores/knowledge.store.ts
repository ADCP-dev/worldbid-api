import { defineStore } from 'pinia'
import { ref } from 'vue'

export type KnowledgeView = 'editor' | 'graph' | 'split'

/**
 * UI state for the Knowledge Agent notes split-view.
 *
 * Data fetching + caching is handled by TanStack Query (useKnowledge.ts).
 * This store only holds ephemeral UI state: selected note id, active view
 * (editor vs graph), and the current search query.
 */
export const useKnowledgeStore = defineStore('knowledge', () => {
  const selectedId = ref<string | null>(null)
  const view = ref<KnowledgeView>('graph')
  const searchQuery = ref('')
  const sidebarOpen = ref(false)
  const backlinksOpen = ref(false)

  function selectNote(id: string | null) {
    selectedId.value = id
    // If the user is already in split or editor view, keep that view —
    // switching notes shouldn't force them back to editor-only.
    // Only switch to editor if we're currently in graph-only view.
    if (id && view.value === 'graph') view.value = 'editor'
  }

  function openGraph() {
    view.value = 'graph'
  }

  function openEditor() {
    view.value = 'editor'
  }

  function openSplit() {
    view.value = 'split'
  }

  function toggleView() {
    view.value = view.value === 'graph' ? 'editor' : 'graph'
  }

  function setView(v: KnowledgeView) {
    view.value = v
  }

  function setSearch(q: string) {
    searchQuery.value = q
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleBacklinks() {
    backlinksOpen.value = !backlinksOpen.value
  }

  function setBacklinks(open: boolean) {
    backlinksOpen.value = open
  }

  return {
    selectedId,
    view,
    searchQuery,
    sidebarOpen,
    backlinksOpen,
    selectNote,
    openGraph,
    openEditor,
    openSplit,
    toggleView,
    setView,
    setSearch,
    toggleSidebar,
    closeSidebar,
    toggleBacklinks,
    setBacklinks,
  }
})