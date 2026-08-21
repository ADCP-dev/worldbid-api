---
doc: knowledge-agent/03-requirements
title: "Requisitos"
status: draft
created: 2026-08-21
---

# Requisitos

## Requisitos funcionales — Knowledge Base (FR-100s)

### FR-101 — Nota CRUD
THE SYSTEM SHALL expose `GET /api/v1/ka/notes` (list with pagination), `POST /ka/notes` (create), `GET /ka/notes/:id`, `PATCH /ka/notes/:id`, `DELETE /ka/notes/:id`.
WHEN a note is created or updated THE SYSTEM SHALL parse `content_md` for YAML frontmatter (OKF format) and store parsed fields in `frontmatter` jsonb column.

### FR-102 — Embedding on save
WHEN a note is created or updated THE SYSTEM SHALL generate an embedding vector(1536) from `content_md` using `OllamaEmbeddings` and store it in `ext_ka_notes.embedding`.
IF embedding generation fails THE SYSTEM SHALL persist the note with `embedding=NULL` and log a warning, not block the save.

### FR-103 — Link extraction
WHEN a note is created or updated THE SYSTEM SHALL extract `[[link]]` references from `content_md` and store them for backlink queries.
THE SYSTEM SHALL expose `GET /ka/notes/:id/backlinks` returning notes that link to `:id`.

### FR-104 — TipTap editor (ref RichEditor base)
THE SYSTEM SHALL render a note editor using `RichEditor` from `@base/ui-app/components/` (TipTap-based) that serializes content to markdown.
WHEN the user saves THE SYSTEM SHALL serialize TipTap JSON to markdown string and send as `content_md`.

### FR-105 — Frontmatter OKF
THE SYSTEM SHALL support OKF frontmatter fields: `type`, `title`, `description`, `tags` (array), `sources` (array), `generated` (boolean), `okf_version` (string).
WHEN frontmatter is missing or invalid THE SYSTEM SHALL default `okf_version="1.0"`, `type="note"`, `generated=false`, and not block the save.

### FR-106 — Visor árbol jerárquico
THE SYSTEM SHALL render a sidebar tree view organizing notes by `tags` (primary) or `frontmatter.type` (secondary).
WHEN a node is clicked THE SYSTEM SHALL navigate to the note editor/reader.

### FR-107 — Visor de grafo
THE SYSTEM SHALL render a graph view (vue-flow or cytoscape [NEEDS CLARIFICATION: ver Q-05]) where nodes = notes and edges = `[[link]]` references.
THE SYSTEM SHALL support backlinks: clicking a node shows incoming links.
WHEN the graph has > 500 nodes THE SYSTEM SHALL apply layout optimization and render in < 1s.

## Requisitos funcionales — RAG (FR-200s)

### FR-201 — Búsqueda semántica
THE SYSTEM SHALL expose `GET /api/v1/ka/notes/search?q=<query>&top=5` returning notes ranked by cosine similarity between query embedding and `ext_ka_notes.embedding` via `PGVectorStore`.
IF `embedding` is NULL for a note THE SYSTEM SHALL exclude it from search results.

### FR-202 — RAG context injection
WHEN the DeepAgent receives a user query THE SYSTEM SHALL perform a similarity search against `ext_ka_notes` and inject top-k results as context into the agent's prompt.
THE SYSTEM SHALL use `PGVectorStore.similaritySearchWithScore(query, k)` from langchainjs.

## Requisitos funcionales — DeepAgent (FR-300s)

### FR-301 — Agent factory
THE SYSTEM SHALL provide `build_agent(agent_config_id)` that loads: systemPrompt from `ext_ka_agent_configs`, tools from `ToolCollector` + `MCPLoader`, model string from `ext_ka_models` (active).
WHEN the same `agent_config_id` is requested and config has not changed THE SYSTEM SHALL return a cached agent instance (cache key = config hash).

### FR-302 — Agent.md dinámico en DB
THE SYSTEM SHALL store agent system prompts in `ext_ka_agent_configs.system_prompt` (text), not in a fixed file.
THE SYSTEM SHALL expose `GET /api/v1/ka/agent-configs` and `PATCH /ka/agent-configs/:id` to edit system prompts from the frontend.

### FR-303 — Modelo configurable
THE SYSTEM SHALL resolve the model string from `ext_ka_models` (where `active=true` for the agent's provider) as `"provider:model_id"`.
WHEN the active model is changed in DB THE SYSTEM SHALL rebuild the agent on the next request (cache invalidation by config hash).

### FR-304 — Providers soportados
THE SYSTEM SHALL support model providers: `ollama` (Ollama Cloud) and `openrouter` (OpenRouter).
[NEEDS CLARIFICATION: ¿añadir `openai` y `anthropic` en v1? ver Q-06]

### FR-305 — Tools de extensiones auto-discovery
THE SYSTEM SHALL scan all extensions for `agent.tools.ts` files via glob pattern and collect exported LangChain tools.
IF an extension has no `agent.tools.ts` file THE SYSTEM SHALL skip it gracefully (no error).
THE SYSTEM SHALL merge collected tools into the agent's tool list at build time.

### FR-306 — MCP servers externos
THE SYSTEM SHALL store MCP server configs in `ext_ka_mcp_servers` (name, transport, url, api_key_ref, enabled).
WHEN building an agent THE SYSTEM SHALL load enabled MCP servers, call `MultiServerMCPClient({ ... }).getTools()`, and merge resulting tools.
IF an MCP server is unreachable THE SYSTEM SHALL log a warning and continue without its tools (graceful degradation).

## Requisitos funcionales — Sandbox (FR-400s)

### FR-401 — Execute tool aislado
THE SYSTEM SHALL provide an `execute` tool to the DeepAgent that runs commands (curl, scripts, math) in an isolated sandbox.
THE SYSTEM SHALL use `SandboxBackend` from deepagents: Node VFS in dev, Daytona in prod [NEEDS CLARIFICATION: ver Q-04].

### FR-402 — Permisos declarativos
THE SYSTEM SHALL deny sandbox access to: `.env` files, credential files, `apps/`, `packages/`, `src/` directories.
THE SYSTEM SHALL allow sandbox access to: tmp workspace, user-specified safe paths.

### FR-403 — isolated-vm para eval liviano
WHEN the agent needs lightweight evaluation (math, string ops) THE SYSTEM SHALL use `isolated-vm` (QuickJS) instead of full microVM sandbox.

## Requisitos funcionales — Chat con sesiones (FR-500s)

### FR-501 — Sesiones persistentes
THE SYSTEM SHALL persist chat sessions in `ext_ka_chat_sessions` (id, agent_config_id, title, createdAt, updatedAt).
THE SYSTEM SHALL use `PostgresSaver` checkpointer to persist conversation state across requests.

### FR-502 — Streaming SSE
WHEN a user sends a message THE SYSTEM SHALL stream the agent's response via SSE (Server-Sent Events) from `POST /api/v1/ka/chat/:sessionId/stream`.
THE SYSTEM SHALL use `stream_events(version="v3")` from LangGraph and emit typed projections (messages, tool_calls, values).

### FR-503 — Render rich frontend
THE SYSTEM SHALL render streamed chat messages with: markdown via `markdown-it`, code blocks with syntax highlighting via `highlight.js`, HTML sanitized via `DOMPurify`.

### FR-504 — Chat UI estilo ChatGPT
THE SYSTEM SHALL render a chat interface with: message list (user + assistant), input box, session sidebar, streaming indicators, code block copy button.
WHEN a code block is rendered THE SYSTEM SHALL show a copy button and language label.

## Requisitos funcionales — Config en DB (FR-600s)

### FR-601 — Model providers CRUD
THE SYSTEM SHALL expose `GET/POST/PATCH/DELETE /api/v1/ka/model-providers` for managing providers (name, provider enum, api_key_ref, base_url).
THE SYSTEM SHALL store `api_key_ref` as a reference to an env var name, never the actual API key value.

### FR-602 — Models CRUD
THE SYSTEM SHALL expose `GET/POST/PATCH/DELETE /api/v1/ka/models` for managing models (provider_id FK, model_id, display_name, context_window, active).
WHEN a model is set `active=true` THE SYSTEM SHALL deactivate other models for the same provider (exclusive active per provider).

### FR-603 — Agent configs CRUD
THE SYSTEM SHALL expose `GET/POST/PATCH/DELETE /api/v1/ka/agent-configs` for managing agent configurations (name, system_prompt, model_id FK, mcp_server_ids[]).

### FR-604 — MCP servers CRUD
THE SYSTEM SHALL expose `GET/POST/PATCH/DELETE /api/v1/ka/mcp-servers` for managing MCP server configs (agent_config_id FK, name, transport, url, api_key_ref, enabled).

## Requisitos funcionales — RBAC

### FR-701 — Guards en endpoints
THE SYSTEM SHALL apply `AuthGuard('jwt')` + `RolesGuard` with `@Roles(RoleEnum.admin)` to: config endpoints (providers, models, agent-configs, mcp-servers CRUD), note delete.
THE SYSTEM SHALL apply `AuthGuard('jwt')` (any authenticated user) to: notes read/create/edit, chat endpoints, search.

## Requisitos no funcionales (NFR-NNN)

### NFR-001 — Embedding performance
WHEN a note of 5k characters is saved THE SYSTEM SHALL generate the embedding in < 2s.

### NFR-002 — Search performance
WHEN semantic search is requested over 10k notes THE SYSTEM SHALL respond in < 500ms.

### NFR-003 — Graph render performance
WHEN the graph view renders 500 nodes THE SYSTEM SHALL complete rendering in < 1s.

### NFR-004 — Chat latency
WHEN a user sends a message THE SYSTEM SHALL emit the first SSE token in < 3s (Ollama Cloud) or < 2s (OpenRouter).

### NFR-005 — Sandbox isolation
THE SYSTEM SHALL guarantee that sandboxed commands cannot access the project's source code, environment files, or credentials.

### NFR-006 — API key safety
THE SYSTEM SHALL never log or expose API key values. Only `api_key_ref` (env var name) is stored in DB. Keys are resolved from `process.env` at runtime.

### NFR-007 — Session persistence
THE SYSTEM SHALL guarantee that chat sessions survive server restarts (PostgresSaver persistence).

### NFR-008 — i18n
THE SYSTEM SHALL source all UI labels from `apps/front/i18n/locales/{es,en}/` under `knowledgeAgent` namespace.

### NFR-009 — Agent cache invalidation
WHEN an agent config is updated THE SYSTEM SHALL invalidate the cache entry for that config hash on the next request.

### NFR-010 — Graceful MCP degradation
IF an MCP server is unreachable THE SYSTEM SHALL log a warning and build the agent without that server's tools, not fail the request.

### NFR-011 — Logging
THE SYSTEM SHALL use NestJS `Logger` for all logging. Never `console.log`.

### NFR-012 — TypeScript strict
THE SYSTEM SHALL pass `pnpm check-types` with zero errors. No `any` types — use `unknown` + guards.