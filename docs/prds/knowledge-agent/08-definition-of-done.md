---
doc: knowledge-agent/08-definition-of-done
title: "Knowledge Agent — Definition of Done"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Definition of Done

## Checklist por fase

### Fase 1: Schema + KB CRUD

- [ ] Migraciones generadas con `pnpm migration:generate` (no SQL hardcode).
- [ ] Tabla `ext_ka_notes` con prefijo `ext_ka_` y todas las columnas
  (`id`, `title`, `content_md`, `category_path`, `tags`, `frontmatter`,
  `embedding`, `user_id`, `created_at`, `updated_at`, `deleted_at`,
  `deleted_by`).
- [ ] Tabla `ext_ka_note_links` (`source_note_id`, `target_note_id`).
- [ ] Index pgvector en `embedding`.
- [ ] Index en `category_path` y `user_id`.
- [ ] CRUD endpoints funcionan con `user_id` filter.
- [ ] Re-embed on create/update con `OllamaEmbeddings`.
- [ ] Soft delete funciona (`deleted_at` + `deleted_by`).
- [ ] Editor TipTap serializa a markdown y guarda en DB.
- [ ] Visor árbol básico expande/colapsa categorías.
- [ ] Tests backend pasan (≥ 80% cobertura módulo).
- [ ] Lint pasa.

### Fase 2: Visor grafo d3-force

- [ ] `GraphView.vue` portado de demo React + d3-force a Vue 3.
- [ ] Endpoint `GET /api/knowledge/graph` retorna `{ nodes, edges }`.
- [ ] `forceLink`, `forceManyBody`, `forceCollide`, `forceX`/`forceY`
  configurados.
- [ ] Zoom/pan con `d3-zoom` funciona.
- [ ] Nodos con radio según degree.
- [ ] Hover: highlight vecinos, dim resto.
- [ ] Selected: halo glow + panel lateral con backlinks.
- [ ] Search + filter por categoría funcionan.
- [ ] Drag para fijar posición funciona.
- [ ] Render ≥ 30 FPS hasta 500 nodos.
- [ ] Tests frontend pasan.
- [ ] Lint pasa.

### Fase 3: DeepAgent + sandbox

- [ ] `deepagents` npm + dependencias LangChain instaladas (Q-06, Q-07, Q-08
  resueltas).
- [ ] `build_agent(agent_config_id, userId)` factory implementada.
- [ ] Tabla `ext_ka_agent_configs` con `name`, `system_prompt`, `model`,
  `provider`, `permissions`, `mcp_servers`.
- [ ] Cache por config hash funciona (hit/miss logs en `build_agent`).
- [ ] Reconstrucción por request cuando config hash cambió.
- [ ] Sandbox Node VFS con working dir aislado por session.
- [ ] Permisos declarativos: deny a `.env`, creds, código del proyecto.
- [ ] `isolated-vm` evalúa scripts sin shell/network.
- [ ] `execute(command, args)` tool funciona.
- [ ] Test: permisos deny bloquean acceso a `.env` (verificar 403/throw).
- [ ] Tests backend pasan.
- [ ] Lint pasa.

### Fase 4: Agent KB tools + tools de extensiones

- [ ] `search_notes_tree(categoryPath, depth)` funciona.
- [ ] `search_notes_semantic(query, topK)` usa pgvector.
- [ ] `create_note` genera embedding automáticamente.
- [ ] `update_note` re-embedda si `content_md` cambia.
- [ ] `delete_note` hace soft delete + auditoría (`deleted_by`).
- [ ] Re-embed y re-extract `note_links` on create/update.
- [ ] Auto-discovery de `agent.tools.ts` en extensiones (glob).
- [ ] Tools se mergean en array unificado en el agente.
- [ ] Tests backend pasan (incluye test de agente creando/editando nota).
- [ ] Lint pasa.

### Fase 5: MCP externos + chat con sesiones

- [ ] Tabla `ext_ka_mcp_servers` (`agent_config_id`, `name`, `transport`,
  `url`, `api_key_ref`, `enabled`).
- [ ] `MultiServerMCPClient` carga servers al construir agente.
- [ ] Tools de MCP se mergean con tools nativas.
- [ ] `PostgresSaver` checkpointer persiste sesiones.
- [ ] Tabla `ext_ka_chat_sessions` con `user_id` (aislamiento).
- [ ] Streaming SSE desde NestJS (`stream_events v3`).
- [ ] Render rich: `markdown-it` + `highlight.js` + `DOMPurify` funciona.
- [ ] **Test cross-user access → 403** (sesión de usuario A no accesible por
  usuario B).
- [ ] Reanudar sesión carga historial previo.
- [ ] `userId` en state de LangGraph para que tools operen en scope del usuario.
- [ ] Tests backend + frontend pasan.
- [ ] Lint pasa.

### Fase 6: Config UI + polish

- [ ] Tabla `ext_ka_model_providers` (`name`, `provider`, `api_key_ref`,
  `base_url`, `enabled`).
- [ ] Tabla `ext_ka_models` (`provider_id`, `model_id`, `display_name`,
  `context_window`, `active`).
- [ ] UI cambia modelo/proveedor de agente.
- [ ] Agente se reconstruye al cambiar config (invalidate cache).
- [ ] `api_key_ref` guarda referencia (no valor plano).
- [ ] RBAC: solo admin gestiona configs.
- [ ] Tests E2E de config UI pasan.
- [ ] Lint pasa.

## Checklist globales

- [ ] Tests pasan (backend, strict TDD).
- [ ] Lint pasa (`pnpm lint`).
- [ ] Type-check pasa (`pnpm check-types`).
- [ ] Todas las tablas usan prefijo `ext_ka_`.
- [ ] Extension auto-discovery funciona (copiar carpeta → funciona, borrar
  carpeta → desaparece).
- [ ] Sesiones aisladas por usuario (test cross-user access → 403).
- [ ] Sandbox aislado (test permisos deny a `.env` → bloqueado).
- [ ] `doc .md` creado en `docs/extensions/knowledge-agent.md` con YAML
  frontmatter (`id: knowledge-agent`, `name`, `type: extension`, `parent: null`,
  `dependencies: [auth]`).
- [ ] `pnpm docs:sync` ejecutado exitosamente (regenera `ARCHITECTURE.md`).
- [ ] Commits con conventional commits (`feat:`, `fix:`, `docs:`).
- [ ] Sin "Co-Authored-By" ni atribución IA en commits.
- [ ] NestJS `Logger` usado (no `console.log`).
- [ ] Aliases absolutos (`@ext/knowledge-agent/*`, `@iam/*`, `@infra/*`).
- [ ] `import type` para tipos que no se instancian.
- [ ] Sin `any` (usar `unknown` + guards).