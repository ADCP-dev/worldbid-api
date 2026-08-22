/**
 * Composable for the Knowledge Agent extension.
 * Wraps all API calls to the backend knowledge notes endpoints.
 */

export interface Note {
  id: string;
  title: string;
  contentMd: string;
  categoryPath: string | null;
  tags: string[];
  frontmatter: Record<string, unknown>;
  embedding: number[] | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateNotePayload {
  title: string;
  contentMd: string;
  categoryPath?: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
}

export interface UpdateNotePayload {
  title?: string;
  contentMd?: string;
  categoryPath?: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
}

export interface QueryNotesParams {
  categoryPath?: string;
  depth?: number;
  search?: string;
  tags?: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  tags: string[];
  categoryPath: string | null;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface QueryGraphParams {
  categoryPath?: string;
  tag?: string;
}

function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';

  async function apiFetch<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, unknown>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }
    return await $fetch<T>(`${baseUrl}${apiPrefix}${path}`, {
      method: options.method,
      query: options.query,
      body: options.body as BodyInit | Record<string, unknown> | null | undefined,
      headers,
    }) as T;
  }

  return { apiFetch };
}

export function useKnowledge() {
  const { apiFetch } = useApi();

  async function getNotes(params: QueryNotesParams = {}): Promise<Note[]> {
    const query: Record<string, string | number | undefined> = {};
    if (params.categoryPath) query.categoryPath = params.categoryPath;
    if (params.depth !== undefined) query.depth = params.depth;
    if (params.search) query.search = params.search;
    return apiFetch<Note[]>('/ka/notes', { query });
  }

  async function getNote(id: string): Promise<Note | null> {
    return apiFetch<Note | null>(`/ka/notes/${id}`);
  }

  async function getBacklinks(id: string): Promise<Note[]> {
    return apiFetch<Note[]>(`/ka/notes/${id}/backlinks`);
  }

  async function getGraph(params: QueryGraphParams = {}): Promise<GraphData> {
    const query: Record<string, string | undefined> = {};
    if (params.categoryPath) query.categoryPath = params.categoryPath;
    if (params.tag) query.tag = params.tag;
    return apiFetch<GraphData>('/ka/graph', { query });
  }

  async function createNote(payload: CreateNotePayload): Promise<Note> {
    return apiFetch<Note>('/ka/notes', { method: 'POST', body: payload });
  }

  async function updateNote(
    id: string,
    payload: UpdateNotePayload,
  ): Promise<Note> {
    return apiFetch<Note>(`/ka/notes/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async function deleteNote(id: string): Promise<void> {
    await apiFetch<void>(`/ka/notes/${id}`, { method: 'DELETE' });
  }

  return {
    getNotes,
    getNote,
    getBacklinks,
    getGraph,
    createNote,
    updateNote,
    deleteNote,
  };
}