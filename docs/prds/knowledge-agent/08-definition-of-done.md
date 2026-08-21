---
doc: knowledge-agent/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-08-21
---

# Definition of Done

## Por fase (gate de merge)

### Fase 1 — Schema DB + pgvector
- [ ] Extensión scaffolded con `pnpm generate:extension -- --name=knowledge-agent`.
- [ ] `extension.module.ts` auto-discovered (no se modificó `app.module.ts`).
- [ ] `extension.config.ts` con `registerAs('knowledge-agent')`.
- [ ] 6 entidades creadas con `@Entity('ext_ka_*')` prefix.
- [ ] Migración generada con `pnpm migration:generate InitKnowledgeAgent` y aplicada con `pnpm migration:run`.
- [ ] Migración incluye `CREATE EXTENSION IF NOT EXISTS vector;`.
- [ ] Índice IVFFlat o HNSW en `ext_ka_notes.embedding`.
- [ ] Seeds: provider Ollama Cloud, provider OpenRouter, model `glm-5.2` (active), agent config default.
- [ ] `pnpm lint` (apps/back) pasa sin errores.
- [ ] `pnpm check-types` (apps/back) pasa.
- [ ] No `console.log` (Logger).
- [ ] No rutas relativas largas (aliases `@ext/knowledge-agent/*`).

### Fase 2 — Knowledge Base CRUD + RAG
- [ ] `NotesService` + `NotesController` creados con CRUD completo.
- [ ] `RagService` con `PGVectorStore` integration.
- [ ] Embedding on save (OllamaEmbeddings) — async via Bull o sync con fallback `embedding=NULL`.
- [ ] Link extraction `[[link]]` + backlinks query.
- [ ] Frontmatter OKF parse (YAML).
- [ ] `KaNotesPage` usa `DataTable` base (no custom table).
- [ ] `KaNoteEditor` usa `RichEditor` base (no custom TipTap).
- [ ] `KaTreeSidebar` renderiza árbol jerárquico por tags.
- [ ] i18n keys `knowledgeAgent.*` en `apps/front/i18n/locales/es.json` y `en.json`.
- [ ] Test: crear nota → embedding generado < 2s (5k chars).
- [ ] Test: search `?q=test&top=5` < 500ms (10k notas seed).
- [ ] Test: backlinks query retorna notas correctas.
- [ ] `pnpm lint` + `pnpm check-types` apps/back + apps/front pasa.

### Fase 3 — Visor de grafo + Sandbox
- [ ] `KaGraphView` renderiza grafo con vue-flow o cytoscape [Q-05 resuelto].
- [ ] Nodos = notas, edges = links `[[]]`, backlinks bidireccionales.
- [ ] Grafo de 500 nodos renderiza < 1s.
- [ ] Filtro por tag/categoría funcional.
- [ ] `SandboxService` con `execute` tool + SandboxBackend (Node VFS dev).
- [ ] Permisos declarativos: deny a `.env`, creds, `apps/`, `packages/`, `src/`.
- [ ] `isolated-vm` para eval liviano (o fallback `vm` documentado — Q-11).
- [ ] Test: sandbox ejecuta `curl` retorna response.
- [ ] Test: sandbox deniega acceso a `.env` (test explícito).
- [ ] Test: sandbox deniega acceso a `apps/` (test explícito).
- [ ] `pnpm lint` + `pnpm check-types` pasa.

### Fase 4 — DeepAgent + Tools + MCP
- [ ] `AgentFactoryService` con `build_agent(config_id)` + cache por config hash.
- [ ] `ToolCollectorService` con glob auto-discovery de `agent.tools.ts`.
- [ ] `McpLoaderService` con `MultiServerMCPClient` + timeout 3s + graceful degradation.
- [ ] `ConfigService` + `ConfigController` con CRUD model-providers, models, agent-configs, mcp-servers.
- [ ] RBAC: `@Roles(RoleEnum.admin)` en config endpoints (FR-701).
- [ ] `KaAdminPanel` frontend con `FormInput`, `FormSelect`, `FormSwitch`, `DataTable` base.
- [ ] Test: `build_agent` retorna instancia < 1s (cache hit).
- [ ] Test: tools de extensión con `agent.tools.ts` se cargan.
- [ ] Test: extensión sin `agent.tools.ts` → skip graceful.
- [ ] Test: MCP caído → warning + agente sin esas tools (NFR-010).
- [ ] Test: cambiar model active → agente reconstruido (cache invalidation).
- [ ] Test: non-admin → 403 en config endpoints.
- [ ] `pnpm lint` + `pnpm check-types` pasa.

### Fase 5 — Chat con sesiones + Streaming SSE
- [ ] `ChatService` con `PostgresSaver` checkpointer.
- [ ] `ext_ka_chat_sessions` persistencia de sesiones.
- [ ] RAG context injection (FR-202) antes de enviar al agente.
- [ ] `ChatController` con `POST /ka/chat/:sessionId/stream` (SSE).
- [ ] SSE stream usa `stream_events(version="v3")`.
- [ ] `KaChatPage` con chat UI estilo ChatGPT.
- [ ] `KaChatMessage` con `markdown-it` + `highlight.js` + `DOMPurify`.
- [ ] Code block copy button + language label.
- [ ] `useKa` composable con TanStack Query + EventSource.
- [ ] Test: primer token SSE < 3s (Ollama) / < 2s (OpenRouter).
- [ ] Test: sesión persiste tras server restart.
- [ ] Test: markdown, code highlighting, HTML sanitizado renderizan.
- [ ] Test: RAG context inyecta notas relevantes en prompt.
- [ ] `pnpm lint` + `pnpm check-types` pasa.

### Fase 6 — Polish + tests E2E + docs
- [ ] Tests E2E: flujo completo nota → embedding → search → chat.
- [ ] Test E2E: cambiar model → agente reconstruido.
- [ ] Test E2E: MCP caído → graceful degradation.
- [ ] Test E2E: sandbox deny a `.env`.
- [ ] `docs/extensions/knowledge-agent.md` creado con YAML frontmatter válido (id, name, type, parent, dependencies, entities, external_apis).
- [ ] `pnpm docs:sync` ejecutado — `docs/ARCHITECTURE.md` regenerado sin errores YAML.
- [ ] Edge cases cubiertos: nota sin frontmatter, embedding NULL, grafo vacío, sesión sin mensajes.
- [ ] i18n es + en completo.
- [ ] Responsive mobile.

## Globales (todas las fases)

- [ ] Commits con conventional commits (`feat(ka):`, `fix(ka):`, `docs(ka):`).
- [ ] Sin `Co-Authored-By` ni atribución IA.
- [ ] No se modificó `app.module.ts`.
- [ ] No se tocaron archivos fuera de scope (ver TypeScript guidelines §11.8).
- [ ] `docs/extensions/knowledge-agent.md` actualizado con entities/rutas/dependencies.
- [ ] `pnpm docs:sync` ejecutado sin errores.
- [ ] Branch + PR creado (con `gh pr create`).
- [ ] Decisiones clave guardadas en Engram (`mem_save`) — pgvector, deepagents, sandbox, SSE, PostgresSaver.

## Gates de no-merge

Cualquiera de estos bloquea merge:

- ❌ Sandbox permite acceso a `.env`, creds, o código del proyecto.
- ❌ API key hardcodeada en código o DB (no `api_key_ref`).
- ❌ `app.module.ts` modificado.
- ❌ `console.log` introducido.
- ❌ Secret en código.
- ❌ Ruta relativa larga (`../../../`).
- ❌ Migración SQL escrita a mano.
- ❌ Componente custom cuando existe base-ui equivalente (RichEditor, DataTable, FormInput, etc.).
- ❌ `any` type sin `eslint-disable` justificado.
- ❌ `pgvector` extensión no verificada en migración.
- ❌ MCP server caído bloquea build del agente (no graceful degradation).
- ❌ Chat sin DOMPurify (XSS risk).
- ❌ Sesiones no persisten tras restart (no PostgresSaver).