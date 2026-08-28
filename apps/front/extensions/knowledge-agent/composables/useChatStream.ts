/**
 * useChatStream — SSE composable for the Knowledge Agent chat.
 *
 * Opens a POST request to the chat message endpoint with
 * `Accept: text/event-stream`, reads the streaming response body, and parses
 * full SSE frames (an `event:` name + one or more `data:` lines per frame,
 * frames separated by blank lines).
 *
 * Frame contract with the backend (chat-session.controller.ts):
 *   - `data: <token>`                              — assistant text delta
 *   - `event: tool_call\ndata: <json>`             — agent invoked a tool
 *   - `event: tool_result\ndata: <json>`           — tool returned
 *   - `event: done\ndata: [DONE]`                  — stream end sentinel
 *
 * Reactive state:
 *   - `messages`: array rendered by ChatMessage.vue (see ChatMessage.toolCalls)
 *   - `isStreaming`: true while the response is being received
 *   - `currentStream`: the in-progress assistant text (updated live)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';

/** One tool invocation surfaced by the agent during streaming. */
export interface ChatToolCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  /** Present after `tool_result` arrives. */
  output?: string;
}

/** Metadata for a file attached to a user message. */
export interface ChatAttachmentMeta {
  name: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Tool calls attributed to this assistant message (streaming or history). */
  toolCalls?: ChatToolCall[];
  /** Files attached by the user (rendered as chips above the bubble). */
  attachments?: ChatAttachmentMeta[];
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
  async function sendMessage(
    sessionId: string,
    content: string,
    attachments?: Array<{ name: string; mimeType: string; data: string }>,
  ): Promise<void> {
    if (isStreaming.value) return;
    error.value = null;
    isStreaming.value = true;
    currentStream.value = '';

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      attachments: attachments?.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    };
    messages.value.push(userMsg);

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      toolCalls: [],
    };
    messages.value.push(assistantMsg);

    // IMPORTANT: `assistantMsg` above is a RAW object — mutating it directly
    // does NOT trigger Vue reactivity (the local variable points at the
    // plain object, not the proxy Vue created when it entered the reactive
    // array). Re-read the last element through `messages.value` to get the
    // reactive proxy, and mutate ONLY that reference below.
    const liveAssistant = messages.value[messages.value.length - 1] as ChatMessage;

    abortController = new AbortController();

    /**
     * Inactivity watchdog: if the server sends NOTHING for 120s (hung agent,
     * proxy stall, crashed run), abort so the UI un-sticks instead of
     * spinning "responding…" forever. Hoisted outside the try so the
     * catch/finally can clear it and detect timeout-vs-user-stop.
     */
    let lastActivity = Date.now();
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const touch = (): void => {
      lastActivity = Date.now();
    };

    try {
      // Single POST with manual SSE response (backend uses @Res() to write
      // text/event-stream frames directly, avoiding the NestJS @Sse() GET
      // limitation).
      const resp = await fetch(
        `${baseUrl}${apiPrefix}/ka/chat/sessions/${sessionId}/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: content, attachments: attachments ?? [] }),
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

      watchdog = setInterval(() => {
        if (Date.now() - lastActivity > 120_000) {
          abortController?.abort();
        }
      }, 10_000);

      /**
       * Split `buffer` into complete SSE frames (separated by blank lines),
       * mutating `buffer` to keep only the trailing partial. SSE line
       * endings may be \n\n or \r\n\r\n; normalize to \n\n first.
       */
      function extractFrames(): Array<{ event: string; data: string }> {
        buffer = buffer.replace(/\r\n/g, '\n');
        const frames: Array<{ event: string; data: string }> = [];
        let idx: number;
        for (;;) {
          idx = buffer.indexOf('\n\n');
          if (idx === -1) break;
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!block) continue;
          let eventName = '';
          const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
          }
          frames.push({ event: eventName, data: dataLines.join('\n') });
        }
        return frames;
      }

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        touch();
        buffer += decoder.decode(value, { stream: true });

        for (const frame of extractFrames()) {
          touch();
          if (frame.event === 'done' || frame.data === '[DONE]') continue;

          if (frame.event === 'error') {
            try {
              const payload = JSON.parse(frame.data) as { message?: string };
              error.value = payload.message ?? 'Unknown stream error';
            } catch {
              error.value = frame.data;
            }
            continue;
          }

          if (frame.event === 'tool_call') {
            try {
              const payload = JSON.parse(frame.data) as {
                name: string;
                args?: Record<string, unknown>;
                id?: string;
              };
              liveAssistant.toolCalls = liveAssistant.toolCalls ?? [];
              liveAssistant.toolCalls.push({
                id: payload.id,
                name: payload.name,
                args: payload.args,
              });
            } catch {
              // malformed frame — ignore
            }
            continue;
          }

          if (frame.event === 'tool_result') {
            try {
              const payload = JSON.parse(frame.data) as {
                name: string;
                output?: string;
                id?: string;
              };
              const calls = liveAssistant.toolCalls ?? [];
              const match = payload.id
                ? calls.find((c) => c.id === payload.id)
                : [...calls].reverse().find((c) => c.name === payload.name && c.output === undefined);
              if (match) {
                match.output = payload.output ?? '';
              }
            } catch {
              // ignore malformed frame
            }
            continue;
          }

          // Default: text delta frame (no event name).
          if (!frame.event && frame.data) {
            currentStream.value += frame.data;
            liveAssistant.content = currentStream.value;
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Distinguish user stop from watchdog timeout: the watchdog only
        // aborts after 120s of silence, so a recent lastActivity means the
        // user hit Stop (or navigation) — not an error.
        if (Date.now() - lastActivity > 100_000) {
          error.value = 'Stream timed out after 2 minutes of inactivity.';
        }
      } else {
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      if (watchdog !== null) clearInterval(watchdog);
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
  const queryClient = useQueryClient();
  const queryKey = ['ka-chat-sessions'] as const;

  const authHeaders = computed<Record<string, string>>((): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {},
  );

  async function fetchSessions(): Promise<ChatSession[]> {
    return await $fetch<ChatSession[]>(`${baseUrl}${apiPrefix}/ka/chat/sessions`, {
      headers: authHeaders.value,
    });
  }

  async function getSession(id: string): Promise<ChatSession | null> {
    return await $fetch<ChatSession | null>(
      `${baseUrl}${apiPrefix}/ka/chat/sessions/${id}`,
      { headers: authHeaders.value },
    );
  }

  async function createSessionRequest(
    payload: CreateChatSessionPayload,
  ): Promise<ChatSession> {
    return await $fetch<ChatSession>(`${baseUrl}${apiPrefix}/ka/chat/sessions`, {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders.value,
      },
    });
  }

  async function updateSessionRequest(
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
          ...authHeaders.value,
        },
      },
    );
  }

  async function deleteSessionRequest(id: string): Promise<void> {
    await $fetch(`${baseUrl}${apiPrefix}/ka/chat/sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders.value,
    });
  }

  const { data: sessions, isLoading: loading } = useQuery({
    queryKey,
    queryFn: fetchSessions,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateChatSessionPayload) => createSessionRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      payload: { title?: string; agentConfigId?: string };
    }) => updateSessionRequest(vars.id, vars.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    sessions,
    loading,
    getSession,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}