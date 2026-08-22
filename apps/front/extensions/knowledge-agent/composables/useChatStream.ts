/**
 * useChatStream — SSE composable for the Knowledge Agent chat.
 *
 * Opens a POST request to the chat message endpoint with
 * `Accept: text/event-stream`, reads the streaming response body, and parses
 * SSE events (each `data:` line is a text delta or the `[DONE]` sentinel).
 *
 * Reactive state:
 *   - `messages`: array of { role, content } rendered by ChatMessage.vue
 *   - `isStreaming`: true while the response is being received
 *   - `currentStream`: the in-progress assistant message (updated live)
 *
 * The backend returns `Observable<MessageEvent>` from the POST endpoint,
 * which NestJS serializes as a standard SSE stream (one `data:` line per
 * chunk, terminated by `event: done\ndata: [DONE]`).
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  id: string;
  userId: number;
  agentConfigId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatSessionPayload {
  agentConfigId?: string;
  title?: string;
}

function useApiBase() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const baseUrl = config.public.apiUrl as string;
  const apiPrefix = (config.public.apiPrefix as string) || '/api/v1';
  const token = authStore.token as string | null;
  return { baseUrl, apiPrefix, token };
}

export function useChatStream() {
  const { baseUrl, apiPrefix, token } = useApiBase();

  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const currentStream = ref<string>('');
  const error = ref<string | null>(null);
  let abortController: AbortController | null = null;

  /**
   * Send a message to the chat session and stream the agent response.
   * Appends the user message immediately, then opens the SSE stream and
   * appends the assistant message incrementally.
   */
  async function sendMessage(sessionId: string, content: string): Promise<void> {
    if (isStreaming.value) return;
    error.value = null;
    isStreaming.value = true;
    currentStream.value = '';

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };
    messages.value.push(userMsg);

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
    };
    messages.value.push(assistantMsg);

    abortController = new AbortController();

    try {
      const resp = await fetch(
        `${baseUrl}${apiPrefix}/ka/chat/sessions/${sessionId}/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: content }),
          signal: abortController.signal,
        },
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
      }
      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event: done')) continue;
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            if (data) {
              currentStream.value += data;
              const last = messages.value[messages.value.length - 1];
              if (last && last.role === 'assistant') {
                last.content = currentStream.value;
              }
            }
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // user cancelled — not an error
      } else {
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      isStreaming.value = false;
      currentStream.value = '';
      abortController = null;
    }
  }

  function stopStreaming(): void {
    if (abortController) {
      abortController.abort();
    }
  }

  /**
   * Load the persisted conversation history for a session from the backend
   * (`GET /ka/chat/sessions/:id/messages`, sourced from the PostgresSaver
   * checkpointer). Populates the `messages` array so reopening a session
   * shows the prior conversation. Call this on session open before sending.
   *
   * Entries arrive as `{ role: 'user' | 'assistant', content }`; we assign
   * synthetic ids so the v-for `:key` stays stable.
   */
  async function loadSessionHistory(sessionId: string): Promise<void> {
    error.value = null;
    try {
      const history = await $fetch<
        Array<{ role: 'user' | 'assistant'; content: string }> | null
      >(`${baseUrl}${apiPrefix}/ka/chat/sessions/${sessionId}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!history) {
        // null = session missing or cross-user (no leak); leave messages empty.
        messages.value = [];
        return;
      }
      messages.value = history.map((m, i) => ({
        id: `h-${sessionId}-${i}`,
        role: m.role,
        content: m.content,
      }));
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  function resetMessages(): void {
    messages.value = [];
    currentStream.value = '';
    error.value = null;
  }

  return {
    messages,
    isStreaming,
    currentStream,
    error,
    sendMessage,
    stopStreaming,
    loadSessionHistory,
    resetMessages,
  };
}

export function useChatSessions() {
  const { baseUrl, apiPrefix, token } = useApiBase();

  async function getSessions(): Promise<ChatSession[]> {
    return await $fetch<ChatSession[]>(`${baseUrl}${apiPrefix}/ka/chat/sessions`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async function getSession(id: string): Promise<ChatSession | null> {
    return await $fetch<ChatSession | null>(
      `${baseUrl}${apiPrefix}/ka/chat/sessions/${id}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
  }

  async function createSession(
    payload: CreateChatSessionPayload,
  ): Promise<ChatSession> {
    return await $fetch<ChatSession>(`${baseUrl}${apiPrefix}/ka/chat/sessions`, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  async function updateSession(
    id: string,
    payload: { title?: string; agentConfigId?: string },
  ): Promise<ChatSession> {
    return await $fetch<ChatSession>(
      `${baseUrl}${apiPrefix}/ka/chat/sessions/${id}`,
      {
        method: 'PATCH',
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
  }

  async function deleteSession(id: string): Promise<void> {
    await $fetch<void>(`${baseUrl}${apiPrefix}/ka/chat/sessions/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  return {
    getSessions,
    getSession,
    createSession,
    updateSession,
    deleteSession,
  };
}