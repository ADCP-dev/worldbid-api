/**
 * useKnowledge — TanStack Query composable for Knowledge Agent notes.
 *
 * Pattern mirrors useUsers.ts: one query/mutation hook per operation,
 * all delegating to useApi() for transport. Cache keys:
 *   - List:  ['ka', 'notes', params]
 *   - One:   ['ka', 'notes', id]
 *   - Graph: ['ka', 'graph', params]
 *
 * All write mutations invalidate the list query (and the single query
 * for the affected id when known).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export interface Note {
  id: string
  title: string
  contentMd: string
  categoryPath: string | null
  tags: string[]
  frontmatter: Record<string, unknown>
  embedding: number[] | null
  /** Creator provenance — metadata only, NOT scoping. Notes are global. */
  userId: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateNotePayload {
  title: string
  contentMd: string
  categoryPath?: string
  tags?: string[]
  frontmatter?: Record<string, unknown>
}

export interface UpdateNotePayload {
  title?: string
  contentMd?: string
  categoryPath?: string
  tags?: string[]
  frontmatter?: Record<string, unknown>
}

export interface QueryNotesParams {
  categoryPath?: string
  depth?: number
  search?: string
  tags?: string[]
}

export interface GraphNode {
  id: string
  label: string
  tags: string[]
  categoryPath: string | null
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface QueryGraphParams {
  categoryPath?: string
  tag?: string
}

const NOTES_KEY = ['ka', 'notes'] as const
const GRAPH_KEY = ['ka', 'graph'] as const

// ── Queries ──────────────────────────────────────────────────────────────

export function useNotesQuery(params: MaybeRefOrGetter<QueryNotesParams> = {}) {
  const api = useApi()
  const resolved = computed<QueryNotesParams>(() => toValue(params))
  return useQuery({
    queryKey: computed(() => [NOTES_KEY, resolved.value] as const),
    queryFn: () => {
      const p = resolved.value
      const query: Record<string, string | number> = {}
      if (p.categoryPath) query.categoryPath = p.categoryPath
      if (p.depth !== undefined) query.depth = p.depth
      if (p.search) query.search = p.search
      return api.get<Note[]>('/ka/notes', { query })
    },
  })
}

export function useNoteQuery(id: MaybeRefOrGetter<string | null>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => [NOTES_KEY, toValue(id)] as const),
    queryFn: () => api.get<Note>(`/ka/notes/${toValue(id) as string}`),
    enabled: computed(() => !!toValue(id)),
  })
}

export function useBacklinksQuery(id: MaybeRefOrGetter<string | null>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => [NOTES_KEY, toValue(id), 'backlinks'] as const),
    queryFn: () =>
      api.get<Note[]>(`/ka/notes/${toValue(id) as string}/backlinks`),
    enabled: computed(() => !!toValue(id)),
  })
}

export function useGraphQuery(params: MaybeRefOrGetter<QueryGraphParams> = {}) {
  const api = useApi()
  const resolved = computed<QueryGraphParams>(() => toValue(params))
  return useQuery({
    queryKey: computed(() => [GRAPH_KEY, resolved.value] as const),
    queryFn: () => {
      const p = resolved.value
      const query: Record<string, string> = {}
      if (p.categoryPath) query.categoryPath = p.categoryPath
      if (p.tag) query.tag = p.tag
      return api.get<GraphData>('/ka/graph', { query })
    },
  })
}

// ── Mutations ────────────────────────────────────────────────────────────

export function useCreateNoteMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNotePayload) => api.post<Note>('/ka/notes', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTES_KEY] })
      qc.invalidateQueries({ queryKey: [GRAPH_KEY] })
    },
  })
}

export function useUpdateNoteMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotePayload }) =>
      api.patch<Note>(`/ka/notes/${id}`, data),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: [NOTES_KEY] })
      qc.invalidateQueries({ queryKey: [NOTES_KEY, note.id] })
      // Backlinks may change when content (wikilinks) change.
      qc.invalidateQueries({ queryKey: [NOTES_KEY, note.id, 'backlinks'] })
      qc.invalidateQueries({ queryKey: [GRAPH_KEY] })
    },
  })
}

export function useDeleteNoteMutation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ka/notes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTES_KEY] })
      qc.invalidateQueries({ queryKey: [GRAPH_KEY] })
    },
  })
}

// ── Imperative helpers (for non-reactive contexts like d3-force graph) ─────

/**
 * Fetch graph data imperatively (outside TanStack Query reactivity).
 * Used by useKnowledgeGraph composable which manages its own d3 state.
 */
export async function fetchGraph(params?: QueryGraphParams): Promise<GraphData> {
  const api = useApi()
  const query: Record<string, string> = {}
  if (params?.categoryPath) query.categoryPath = params.categoryPath
  if (params?.tag) query.tag = params.tag
  return api.get<GraphData>('/ka/graph', { query })
}