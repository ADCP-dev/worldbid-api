---
doc: knowledge-agent/06-migration-phases
title: "Fases de Implementación"
status: draft
created: 2026-08-21
---

# Fases de Implementación

Extensión greenfield. Implementación incremental en 6 fases. Cada fase entregable y mergeable de forma independiente. Fase 1 es base bloqueante para todas las demás.

## Fase 1 — Schema DB + pgvector (BASE, primero)

**Objetivo**: Crear todas las tablas + habilitar pgvector. Base para todo lo demás.

**Entregables**:
- Scaffold extensión con `pnpm generate:extension -- --name=knowledge-agent`.
- `extension.module.ts` + `extension.manifest.ts` + `extension.config.ts` (registerAs).
- 6 entidades:
  - `NoteEntity` (`ext_ka_notes`): id, title, content_md (text), frontmatter (jsonb), embedding (vector(1536)), createdAt, updatedAt.
  - `ChatSessionEntity` (`ext_ka_chat_sessions`): id, agent_config_id (FK), title, createdAt, updatedAt.
  - `AgentConfigEntity` (`ext_ka_agent_configs`): id, name, system_prompt (text), model_id (FK), createdAt, updatedAt.
  - `McpServerEntity` (`ext_ka_mcp_servers`): id, agent_config_id (FK), name, transport (enum), url, api_key_ref, enabled, createdAt.
  - `ModelProviderEntity` (`ext_ka_model_providers`): id, name, provider (enum), api_key_ref, base_url, createdAt.
  - `ModelEntity` (`ext_ka_models`): id, provider_id (FK), model_id, display_name, context_window (int), active (boolean), createdAt.
- Migración: `pnpm migration:generate InitKnowledgeAgent` + `pnpm migration:run`.
  - Migración incluye `CREATE EXTENSION IF NOT EXISTS vector;` al inicio.
  - Índice IVFFlat o HNSW en `ext_ka_notes.embedding`.
  - Índice en `ext_ka_notes(frontmatter->>'tags')` para query por tags.
- Seeds: provider Ollama Cloud (default), provider OpenRouter, model `glm-5.2` (active), agent config default con system prompt base.

**Criterios de salida**:
- `pnpm migration:run` sin errores.
- `ext_ka_*` tablas creadas en DB.
- `pgvector` extensión habilitada.
- `pnpm lint` + `pnpm check-types` apps/back pasa.
- Extensión auto-discovered (aparece en boot sin tocar `app.module.ts`).

**Riesgos**: R-03 — pgvector no disponible. Mitigado: migración verifica y loguea instrucciones.

**Rollback**: `pnpm migration:revert`. Drop tablas + extensión.

---

## Fase 2 — Knowledge Base CRUD + RAG

**Objetivo**: CRUD de notas + embedding + búsqueda semántica.

**Entregables**:
- `NotesService`: CRUD, frontmatter parse, link extraction (`[[link]]`), embedding on save (OllamaEmbeddings), backlinks query.
- `NotesController`: `GET/POST/PATCH/DELETE /ka/notes/*`, `GET /ka/notes/search`, `GET /ka/notes/:id/backlinks`.
- `RagService`: `PGVectorStore` integration, `similaritySearchWithScore(query, k)`.
- Embedding async via Bull queue (si sync falla, no bloquea save). [NEEDS CLARIFICATION: Bull ya en monorepo — ver Q-13].
- Frontend: `KaNotesPage` (DataTable lista), `KaNoteEditor` (RichEditor + FormInput título + frontmatter editor), `KaTreeSidebar` (árbol jerárquico).
- i18n keys `knowledgeAgent.*` en `apps/front/i18n/locales/{es,en}/`.

**Depende de**: Fase 1.

**Criterios de salida**:
- Crear nota → embedding generado < 2s (5k chars).
- Search `?q=test&top=5` retorna notas relevantes < 500ms (10k notas seed).
- Backlinks query retorna notas que linkean a la nota dada.
- `RichEditor` base usado (no custom TipTap).
- `DataTable` base usado para lista.
- `pnpm lint` + `pnpm check-types` pasa.

**Riesgos**: R-02 — embedding latencia. Mitigado: async + `embedding=NULL` fallback.

**Rollback**: Borrar controllers/services/frontend. Tablas persisten (Fase 1).

---

## Fase 3 — Visor de grafo + Sandbox

**Objetivo**: Grafo de nodos/links/backlinks + sandbox de comandos aislados.

**Entregables**:
- `KaGraphView` (frontend): grafo con vue-flow o cytoscape [NEEDS CLARIFICATION: Q-05]. Nodos = notas, edges = links. Backlinks como edges bidireccionales. Filtro por tag/categoría.
- `SandboxService` (backend): `execute` tool con SandboxBackend. Node VFS (dev). Permisos deny a `.env`, creds, `apps/`, `packages/`, `src/`. `isolated-vm` para eval liviano.
- Tests de aislamiento: comando intenta leer `.env` → denied. Comando intenta `ls apps/` → denied.

**Depende de**: Fase 2 (necesita notas para grafo).

**Criterios de salida**:
- Grafo de 500 nodos renderiza < 1s.
- Sandbox ejecuta `curl https://api.example.com` y retorna response.
- Sandbox deniega acceso a `.env` y `apps/` (test explícito).
- `isolated-vm` evalúa `2+2` → 4 sin I/O.
- `pnpm lint` + `pnpm check-types` pasa.

**Riesgos**: R-01 (sandbox escape), R-05 (grafo grande). Mitigados: deny declarativo + filtros grafo.

**Rollback**: Borrar grafo view + sandbox service. CRUD notas sigue funcionando.

---

## Fase 4 — DeepAgent + Tools de extensiones + MCP

**Objetivo**: DeepAgent con `deepagents`, tools auto-discovered, MCP externos, config en DB.

**Entregables**:
- `AgentFactoryService`: `build_agent(agent_config_id)` con cache por config hash. Carga systemPrompt de DB, tools de ToolCollector + MCPLoader, model string de DB.
- `ToolCollectorService`: glob auto-discovery de `agent.tools.ts` en todas las extensiones.
- `McpLoaderService`: `MultiServerMCPClient` desde `ext_ka_mcp_servers`. Timeout 3s. Graceful degradation (NFR-010).
- `ConfigService` + `ConfigController`: CRUD model-providers, models, agent-configs, mcp-servers. RBAC admin (FR-701).
- Frontend: `KaAdminPanel` (config modelos, providers, MCP servers, agent configs con FormInput, FormSelect, FormSwitch, DataTable).
- Integración sandbox: agente usa `execute` tool de Fase 3.

**Depende de**: Fase 1 (tablas config), Fase 3 (sandbox).

**Criterios de salida**:
- `build_agent(config_id)` retorna instancia < 1s (cache hit).
- Tools de extensión con `agent.tools.ts` se cargan. Extensión sin archivo → skip graceful.
- MCP server configurado → tools cargadas en agente. MCP caído → warning + agente sin esas tools.
- Cambiar model active en DB → agente se reconstruye con nuevo model (cache invalidation).
- RBAC: non-admin → 403 en config endpoints.
- `pnpm lint` + `pnpm check-types` pasa.

**Riesgos**: R-04 (deepagents breaking changes), R-06 (MCP caído), R-11 (build lento). Mitigados: pin versión, graceful degradation, cache.

**Rollback**: Borrar factory/services/config frontend. Tablas config persisten.

---

## Fase 5 — Chat con sesiones + Streaming SSE

**Objetivo**: Chat estilo ChatGPT con sesiones persistentes + streaming + RAG context injection.

**Entregables**:
- `ChatService`: `PostgresSaver` checkpointer. Sesiones en `ext_ka_chat_sessions`. RAG context injection (FR-202) antes de enviar al agente.
- `ChatController`: `POST /ka/chat/:sessionId/stream` (SSE endpoint). `GET /ka/chat/sessions` (lista). `POST /ka/chat/sessions` (crear). `PATCH /ka/chat/sessions/:id` (rename).
- SSE stream: `stream_events(version="v3")` → emitir chunks typed (messages, tool_calls, values).
- Frontend: `KaChatPage` (chat UI estilo ChatGPT), `KaChatMessage` (render markdown-it + highlight.js + DOMPurify), session sidebar, streaming indicators, code block copy button.
- `useKa` composable: TanStack Query keys + SSE consumption via EventSource.

**Depende de**: Fase 4 (agente), Fase 2 (RAG).

**Criterios de salida**:
- Primer token SSE < 3s (Ollama Cloud) / < 2s (OpenRouter).
- Sesión persiste tras server restart (PostgresSaver).
- Markdown, code blocks (syntax highlighting), HTML sanitizado renderizan correctamente.
- Code block tiene copy button + language label.
- RAG context: notas relevantes se inyectan en el prompt del agente.
- `pnpm lint` + `pnpm check-types` pasa.

**Riesgos**: R-10 (XSS via chat render). Mitigado: DOMPurify + CSP.

**Rollback**: Borrar chat service/controller/frontend. Agente y notas siguen funcionando.

---

## Fase 6 — Polish + tests E2E + docs

**Objetivo**: Tests E2E, docs, sync architecture, edge cases.

**Entregables**:
- Tests E2E: crear nota → embeddar → buscar → chat usa resultado. Cambiar model → agente reconstruido. MCP caído → graceful degradation. Sandbox deny a `.env`.
- `docs/extensions/knowledge-agent.md` con YAML frontmatter (id, name, type, parent, dependencies, entities, external_apis).
- `pnpm docs:sync` — `docs/ARCHITECTURE.md` regenerado.
- Edge cases: nota sin frontmatter, embedding NULL, grafo vacío, sesión sin mensajes, MCP sin tools.
- i18n completo (es + en).
- Responsive mobile.

**Depende de**: Fases 1-5.

**Criterios de salida**:
- Tests E2E pasan.
- `docs/extensions/knowledge-agent.md` creado con YAML válido.
- `pnpm docs:sync` sin errores YAML.
- `pnpm lint` + `pnpm check-types` apps/back + apps/front pasa.
- i18n es + en completo.

**Rollback**: N/A (fase de validación + docs).

---

## Orden recomendado

```
Fase 1 (schema + pgvector) ──► Fase 2 (CRUD + RAG) ──► Fase 3 (grafo + sandbox)
                                     │                        │
                                     │                        ▼
                                     │              Fase 4 (agent + tools + MCP)
                                     │                        │
                                     ▼                        ▼
                                     └────────────► Fase 5 (chat + SSE)
                                                              │
                                                              ▼
                                                    Fase 6 (polish + tests + docs)
```

Fase 1 **bloqueante** para todas. Fases 2 y 3 paralelizables tras Fase 1. Fase 4 depende de 1 + 3. Fase 5 depende de 2 + 4. Fase 6 depende de todas.