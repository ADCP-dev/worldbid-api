import { defineStore } from 'pinia'
import { ref } from 'vue'

export type KnowledgeView = 'editor' | 'graph'

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

  function selectNote(id: string | null) {
    selectedId.value = id
    if (id) view.value = 'editor'
  }

  function openGraph() {
    view.value = 'graph'
  }

  function openEditor() {
    view.value = 'editor'
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

  return {
    selectedId,
    view,
    searchQuery,
    sidebarOpen,
    selectNote,
    openGraph,
    openEditor,
    toggleView,
    setView,
    setSearch,
    toggleSidebar,
    closeSidebar,
  }
})