import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ChatSessionRepository } from '../chat-session.repository';
import { AgentConfigRepository } from '../agent-config.repository';
import { AgentFactoryService } from '../agent/agent-factory.service';
import { RagService } from '../rag.service';
import { CheckpointerService } from './checkpointer.service';
import { CreateChatSessionDto } from '../../dto/create-chat-session.dto';
import { UpdateChatSessionDto } from '../../dto/update-chat-session.dto';
import { MessageAttachmentDto } from '../../dto/send-message.dto';
import type { ChatSession } from '../../domain/chat-session';
import type { RagHit } from '../rag.service';

/**
 * Multimodal content block (OpenAI-compatible chat format). Kept loose —
 * LangChain accepts these shapes for HumanMessage content arrays.
 */
export interface ContentBlock {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Tool invocation event yielded by the deepagents v3 `run.toolCalls`
 * StreamChannel. `output` is a Promise resolving to the tool result.
 */
export interface DeepAgentToolEvent {
  name: string;
  callId?: string;
  input?: unknown;
  output?: Promise<unknown> | unknown;
  status?: unknown;
  error?: unknown;
}

/**
 * Structured chunk yielded by `streamMessage`. The controller maps these to
 * SSE frames: text → plain `data:` lines; tool events → named `event:` frames
 * with JSON `data`. Old clients that only read `data:` simply ignore tool
 * frames (backward compatible).
 */
export type ChatStreamChunk =
  | { kind: 'text'; text: string }
  | {
      kind: 'tool_call';
      name: string;
      args?: Record<string, unknown>;
      id?: string;
    }
  | {
      kind: 'tool_result';
      name: string;
      output?: string;
      id?: string;
    };

/**
 * ChatService — per-user chat sessions over a DeepAgent config.
 *
 * Responsibilities:
 *   - Session CRUD scoped to the requesting user (403 cross-user, 404 missing).
 *     ChatSession stays per-user; Notes + AgentConfigs are GLOBAL.
 *   - Resolve the agent config: explicit `session.agentConfigId` or the
 *     first config in the global registry as the default when null
 *   - Inject RAG context (semantic search over the GLOBAL knowledge base)
 *     before the user message so the agent can ground its answer
 *   - Stream the agent response token-by-token via `agent.streamEvents`
 *     (Context7-verified deepagents v3 API). Each `run.messages` entry
 *     exposes an async-iterable `.text` that yields incremental text deltas
 *
 * Flow (AD-10):
 *   1. Load session → verify ownership (null/403 cross-user)
 *   2. Resolve agent config (explicit or global default)
 *   3. AgentFactoryService.buildAgent(configId, userId)
 *   4. RAG: similaritySearch the message → prepend context block
 *   5. agent.streamEvents({ messages }, { version: 'v3', configurable: { thread_id } })
 *   6. for await (msg of run.messages) → for await (token of msg.text) → yield token
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly sessionRepo: ChatSessionRepository,
    private readonly agentConfigRepo: AgentConfigRepository,
    private readonly agentFactory: AgentFactoryService,
    private readonly ragService: RagService,
    private readonly checkpointerService: CheckpointerService,
  ) {}

  async createSession(
    userId: number,
    dto: CreateChatSessionDto,
  ): Promise<ChatSession> {
    return this.sessionRepo.create({
      userId,
      agentConfigId: dto.agentConfigId,
      title: dto.title,
    });
  }

  async listSessions(userId: number): Promise<ChatSession[]> {
    return this.sessionRepo.findByUserId(userId);
  }

  /**
   * Returns the session if it belongs to `userId`, otherwise null (403 path).
   * Callers should treat null as "not found OR forbidden" — the controller
   * maps both to the same response to avoid leaking session existence.
   *
   * ChatSession stays per-user (403 cross-user); notes + configs are global.
   */
  async getSession(
    sessionId: string,
    userId: number,
  ): Promise<ChatSession | null> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;
    return session;
  }

  async updateSession(
    sessionId: string,
    userId: number,
    dto: UpdateChatSessionDto,
  ): Promise<ChatSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session)
      throw new NotFoundException(`ChatSession ${sessionId} not found`);
    if (session.userId !== userId) throw new ForbiddenException();
    return this.sessionRepo.update(sessionId, dto);
  }

  async deleteSession(sessionId: string, userId: number): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session)
      throw new NotFoundException(`ChatSession ${sessionId} not found`);
    if (session.userId !== userId) throw new ForbiddenException();
    await this.sessionRepo.remove(sessionId);
  }

  /**
   * Retrieve the persisted conversation history for a session from the
   * LangGraph checkpointer (PostgresSaver). Returns null when the session is
   * missing or belongs to another user (no leak), and an empty array when the
   * session exists but has no checkpoint yet (new session).
   *
   * The checkpointer `getTuple({ configurable: { thread_id } })` returns the
   * latest CheckpointTuple whose `checkpoint.channel_values.messages` holds
   * the BaseMessage array. Each message exposes `getType()` (`human`/`ai`) and
   * `.content` (string).
   */
  async getSessionHistory(
    sessionId: string,
    userId: number,
  ): Promise<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }> | null> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;

    const checkpointer = this.checkpointerService.getCheckpointer() as {
      getTuple: (config: { configurable: { thread_id: string } }) => Promise<
        | {
            checkpoint: {
              channel_values: {
                messages?: Array<{
                  getType: () => string;
                  content: unknown;
                }>;
              };
            };
          }
        | undefined
      >;
    };

    const tuple = await checkpointer.getTuple({
      configurable: { thread_id: sessionId },
    });
    if (!tuple) return [];

    const messages = tuple.checkpoint?.channel_values?.messages ?? [];
    return messages
      .map((m) => this.toHistoryEntry(m))
      .filter(
        (e): e is { role: 'user' | 'assistant'; content: string } =>
          e !== null &&
          // Drop empty assistant shells (LangGraph persists an empty AI
          // message alongside the streamed one — they render as blank
          // bubbles in the UI).
          !(e.role === 'assistant' && e.content.trim() === ''),
      );
  }

  /**
   * Map a LangGraph BaseMessage to a history entry. Only `human` (user) and
   * `ai` (assistant) messages are surfaced; tool calls and system messages
   * are dropped (they are internal to the agent run, not chat UI content).
   *
   * For user messages, the injected RAG context block is stripped — the
   * checkpointer stores the full augmented prompt (RAG + user text) but the
   * UI should show only what the user actually typed.
   */
  private toHistoryEntry(msg: {
    getType: () => string;
    content: unknown;
  }): { role: 'user' | 'assistant'; content: string } | null {
    const type = msg.getType();
    if (type === 'human') {
      const raw = this.contentToString(msg.content);
      return { role: 'user', content: this.stripRagContext(raw) };
    }
    if (type === 'ai') {
      return { role: 'assistant', content: this.contentToString(msg.content) };
    }
    return null;
  }

  /**
   * Remove the RAG context block from an augmented user prompt. The context
   * is appended AFTER the user text behind a unique sentinel header
   * (see buildUserContent) — cut at the LAST occurrence to survive a user
   * literally typing the sentinel earlier in their message.
   */
  private stripRagContext(content: string): string {
    const sentinel = '\n---\n[Knowledge base context]';
    const idx = content.lastIndexOf(sentinel);
    return idx === -1 ? content : content.slice(0, idx);
  }

  private contentToString(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((block) => {
          if (typeof block === 'string') return block;
          if (block && typeof block === 'object' && 'text' in block) {
            return String((block as { text: unknown }).text);
          }
          return '';
        })
        .join('');
    }
    return content != null ? String(content) : '';
  }

  /**
   * Send a message and stream the agent's response tokens + tool events.
   *
   * Yields nothing when the session is missing or cross-user (the caller's
   * async iteration simply completes with zero chunks). Throws
   * `NotFoundException` when the session does not exist at all.
   *
   * Chunk contract:
   *   - { kind: 'text', text } — assistant text deltas (concatenate for message)
   *   - { kind: 'tool_call', name, args?, id? } — agent invoked a tool
   *   - { kind: 'tool_result', name, output?, id? } — tool returned
   */
  async *streamChunks(
    sessionId: string,
    userId: number,
    message: string,
    attachments?: MessageAttachmentDto[],
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const run = await this.startRun(sessionId, userId, message, attachments);
    if (!run) return;
    const agent = run.agent;
    const payload = run.payload;
    const threadId = run.threadId;

    const stream = await this.invokeStream(agent, payload, threadId);

    /**
     * deepagents v3 exposes TWO channels on the run object:
     *   - `stream.messages[i].text` — assistant text deltas (strings only)
     *   - `stream.toolCalls` — StreamChannel of tool invocation events
     *
     * Text deltas NEVER contain tool frames, so we consume both channels
     * concurrently and merge their outputs into a single ordered chunk
     * stream via a tiny async queue.
     */
    const queue: ChatStreamChunk[] = [];
    const resolvers: Array<() => void> = [];
    let textDone = false;

    const wake = (): void => {
      for (const r of resolvers.splice(0)) r();
    };
    const push = (chunk: ChatStreamChunk): void => {
      queue.push(chunk);
      wake();
    };
    const waitForItem = (): Promise<void> =>
      new Promise<void>((resolve) => {
        resolvers.push(resolve);
      });

    // Source 1: assistant text deltas. THE stream ends when text finishes —
    // tool events that land in the queue before then are still drained.
    // We must NOT wait for the toolCalls channel to close: it can outlive
    // the run and would hang the SSE response forever (UI stuck "typing").
    const consumeText = (async () => {
      try {
        for await (const msg of stream.messages) {
          for await (const part of msg.text) {
            push(this.toChunk(part));
          }
        }
      } catch (err) {
        this.logger.warn(
          `text stream error: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        textDone = true;
        wake();
      }
    })();

    // Source 2: tool invocations (may be absent on test stubs). Consumed
    // opportunistically; never blocks stream completion.
    const consumeToolCalls = (async () => {
      const channel = stream.toolCalls;
      if (!channel) return;
      try {
        for await (const tc of channel) {
          push({
            kind: 'tool_call',
            name: tc.name,
            args: (tc.input ?? {}) as Record<string, unknown>,
            id: tc.callId,
          });
          try {
            // `output` is a Promise resolving to the tool result.
            const out = await tc.output;
            const text = this.contentToString(out);
            if (text.trim()) {
              push({
                kind: 'tool_result',
                name: tc.name,
                output: text,
                id: tc.callId,
              });
            }
          } catch (err) {
            push({
              kind: 'tool_result',
              name: tc.name,
              output: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
              id: tc.callId,
            });
          }
        }
      } catch (err) {
        this.logger.warn(
          `toolCalls channel error (text still streaming): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();
    void consumeToolCalls.catch(() => {
      /* channel errors already logged inside */
    });

    // Drain: yield queued chunks until text finished AND queue empty.
    while (!(textDone && queue.length === 0)) {
      if (queue.length === 0) await waitForItem();
      const chunk = queue.shift();
      if (chunk) yield chunk;
    }
  }

  /**
   * Structured streaming alias used by the SSE controller. Yields
   * {@link ChatStreamChunk} objects (text + tool events).
   */
  async *streamMessage(
    sessionId: string,
    userId: number,
    message: string,
    attachments?: MessageAttachmentDto[],
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    yield* this.streamChunks(sessionId, userId, message, attachments);
  }

  /**
   * Text-only alias for `streamChunks` — filters out tool events. Kept for
   * consumers expecting plain string tokens (existing unit tests, scripts).
   */
  async *sendMessage(
    sessionId: string,
    userId: number,
    message: string,
  ): AsyncGenerator<string, void, unknown> {
    for await (const chunk of this.streamChunks(sessionId, userId, message)) {
      if (chunk.kind === 'text') yield chunk.text;
    }
  }

  /**
   * Map one streamed part to a structured chunk. The deepagents streamEvents
   * v3 `.text` iterable yields strings for assistant text; if the runtime
   * surfaces structured tool frames (objects with `type: 'tool'` /
   * `tool_calls` entries), we convert them here defensively. Anything we can
   * not classify degrades to a text chunk (stringified) so the UI never
   * breaks on unexpected shapes.
   */
  private toChunk(part: unknown): ChatStreamChunk {
    if (typeof part === 'string') return { kind: 'text', text: part };

    if (part && typeof part === 'object') {
      const p = part as Record<string, unknown>;
      // Tool-call frame shapes seen across LangChain/LangGraph versions.
      const toolName =
        (typeof p.name === 'string' && p.name) ||
        (typeof p.tool === 'string' ? p.tool : null);
      if (
        (p.type === 'tool_call' ||
          p.type === 'tool_use' ||
          p.kind === 'tool_call') &&
        toolName
      ) {
        return {
          kind: 'tool_call',
          name: toolName,
          args: (p.args ?? p.input ?? {}) as Record<string, unknown>,
          id: typeof p.id === 'string' ? p.id : undefined,
        };
      }
      if (
        (p.type === 'tool_result' ||
          p.type === 'tool_message' ||
          p.type === 'tool') &&
        toolName
      ) {
        return {
          kind: 'tool_result',
          name: toolName,
          output: this.contentToString(p.output ?? p.result ?? p.content ?? ''),
          id: typeof p.id === 'string' ? p.id : undefined,
        };
      }
    }
    return { kind: 'text', text: this.contentToString(part) };
  }

  /**
   * Resolve session + agent + RAG context. Returns null when the session is
   * missing or cross-user (silent skip — caller yields nothing). Throws
   * NotFoundException when the session truly does not exist.
   *
   * Attachments are converted to multimodal content blocks (OpenAI-compatible
   * wire format understood by ChatOpenAI/OpenRouter and Ark): images →
   * image_url, PDFs → file, audio → input_audio, text-like files are decoded
   * and inlined into the prompt text.
   */
  private async startRun(
    sessionId: string,
    userId: number,
    message: string,
    attachments?: MessageAttachmentDto[],
  ): Promise<{
    agent: unknown;
    payload: { messages: Array<{ role: string; content: string | ContentBlock[] }> };
    threadId: string;
  } | null> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session)
      throw new NotFoundException(`ChatSession ${sessionId} not found`);
    if (session.userId !== userId) return null; // cross-user → silent skip

    const configId = await this.resolveConfigId(session, userId);
    const agent = await this.agentFactory.buildAgent(configId, userId);

    const ragContext = await this.injectRag(message);
    const content = this.buildUserContent(message, attachments, ragContext);

    return {
      agent,
      payload: { messages: [{ role: 'user', content }] },
      threadId: sessionId,
    };
  }

  /**
   * Build the user message content: plain string when there are no
   * attachments, or an array of multimodal content blocks otherwise.
   * Blocks follow the OpenAI chat-completions multimodal format that
   * OpenRouter / Ark / OpenAI-compatible endpoints understand.
   */
  private buildUserContent(
    message: string,
    attachments: MessageAttachmentDto[] | undefined,
    ragContext: string | null,
  ): string | ContentBlock[] {
    const textParts: string[] = [message];

    // RAG context goes AFTER the user text behind a unique sentinel so
    // toHistoryEntry can strip it back off for the UI (the user bubble must
    // show only what the user typed, not the injected context).
    if (ragContext) {
      textParts.push('', '---', '[Knowledge base context]', '', ragContext);
    }

    const media: ContentBlock[] = [];
    for (const att of attachments ?? []) {
      if (
        att.mimeType.startsWith('text/') ||
        att.mimeType === 'application/json'
      ) {
        // Text-like files are inlined into the prompt (no modality needed).
        try {
          const decoded = Buffer.from(att.data, 'base64').toString('utf8');
          textParts.push(
            '',
            `--- Attached file: ${att.name} ---`,
            decoded.slice(0, 200_000),
            '--- end of file ---',
          );
        } catch {
          textParts.push(`[Could not decode file: ${att.name}]`);
        }
      } else if (att.mimeType.startsWith('image/')) {
        media.push({
          type: 'image_url',
          image_url: { url: `data:${att.mimeType};base64,${att.data}` },
        });
      } else if (att.mimeType === 'application/pdf') {
        media.push({
          type: 'file',
          file: {
            filename: att.name,
            file_data: `data:application/pdf;base64,${att.data}`,
          },
        });
      } else if (att.mimeType.startsWith('audio/')) {
        media.push({
          type: 'input_audio',
          input_audio: {
            data: att.data,
            format: att.mimeType.split('/')[1] ?? 'wav',
          },
        });
      } else {
        textParts.push(`[Unsupported attachment type: ${att.name} (${att.mimeType})]`);
      }
    }

    if (media.length === 0) return textParts.join('\n');
    return [{ type: 'text', text: textParts.join('\n') }, ...media];
  }

  /**
   * Resolve the agent config id: explicit on the session, or the first
   * config in the global registry as the default when null. Throws
   * NotFoundException when no config exists at all.
   *
   * Configs are GLOBAL (no user scoping); ChatSession keeps per-user scoping.
   * userId stays in the buildAgent call for the per-user ChatSession cache key.
   */
  private async resolveConfigId(
    session: ChatSession,
    _userId: number,
  ): Promise<string> {
    if (session.agentConfigId) return session.agentConfigId;
    const configs = await this.agentConfigRepo.findAll();
    if (configs.length === 0) {
      throw new NotFoundException(
        'No agent config found. Create one in settings.',
      );
    }
    return configs[0].id;
  }

  /** Build the RAG context block from semantic search results (global KB). */
  private async injectRag(message: string): Promise<string | null> {
    try {
      const hits = await this.ragService.search(message, 'semantic', {
        topK: 5,
      });
      if (hits.length === 0) return null;
      return this.formatRagContext(hits);
    } catch (err) {
      this.logger.warn(
        `RAG injection failed: ${err instanceof Error ? err.message : String(err)}. Continuing without context.`,
      );
      return null;
    }
  }

  private formatRagContext(hits: RagHit[]): string {
    const blocks = hits
      .filter((h) => h.contentMd)
      .map((h) => `## ${h.title ?? 'Untitled'}\n${h.contentMd}`);
    return `Relevant notes from your knowledge base:\n\n${blocks.join('\n\n')}`;
  }

  /**
   * Invoke the agent's streamEvents v3 endpoint. Stubbed in tests via the
   * mock agent returned by AgentFactoryService.buildAgent.
   */
  private async invokeStream(
    agent: unknown,
    payload: {
      messages: Array<{ role: string; content: string | ContentBlock[] }>,
    },
    threadId: string,
  ): Promise<{
    messages: AsyncIterable<{ text: AsyncIterable<string> }>;
    toolCalls?: AsyncIterable<DeepAgentToolEvent>;
  }> {
    const checkpointer = this.checkpointerService.getCheckpointer();
    const a = agent as {
      streamEvents: (
        state: unknown,
        config: Record<string, unknown>,
      ) => Promise<{
        messages: AsyncIterable<{ text: AsyncIterable<string> }>;
        toolCalls?: AsyncIterable<DeepAgentToolEvent>;
      }>;
    };
    return a.streamEvents(payload, {
      version: 'v3',
      configurable: {
        thread_id: threadId,
        /**
         * LangGraph reads the runtime checkpointer from
         * `config.configurable.__pregel_checkpointer` (CONFIG_KEY_CHECKPONTER
         * in @langchain/langgraph/dist/constants). A top-level
         * `checkpointers:` field is silently ignored — that's why sessions
         * never persisted history (checkpoints table stayed empty).
         */
        __pregel_checkpointer: checkpointer,
      },
      store: undefined,
    } as Record<string, unknown>);
  }
}
