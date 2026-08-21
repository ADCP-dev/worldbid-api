---
doc: knowledge-agent/03-requirements
title: "Knowledge Agent — Requisitos"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Requisitos

## Requisitos funcionales (EARS)

### Knowledge Base (FR-101 a FR-110)

- **FR-101**: THE SYSTEM SHALL persistir notas markdown en `ext_ka_notes` con
  `id`, `title`, `content_md`, `category_path`, `tags`, `frontmatter`,
  `embedding`, `user_id`, `created_at`, `updated_at`, `deleted_at`,
  `deleted_by`.
- **FR-102**: THE SYSTEM SHALL soportar `category_path` jerárquico (formato
  `frontend/frameworks/react`) con indexación para navegación por niveles.
- **FR-103**: THE SYSTEM SHALL almacenar `tags` como jsonb array transversal
  a la jerarquía de categorías.
- **FR-104**: THE SYSTEM SHALL persistir frontmatter en formato OKF (`type`,
  `sources`, `generated`, `okf_version`) como jsonb.
- **FR-105**: WHEN una nota se crea o su `content_md` cambia THEN THE SYSTEM
  SHALL regenerar el `embedding` vectorial con `OllamaEmbeddings` y persistirlo
  en `ext_ka_notes.embedding`.
- **FR-106**: WHEN el usuario solicita eliminar una nota THEN THE SYSTEM SHALL
  realizar soft delete (`deleted_at` + `deleted_by`) y mantener el registro.
- **FR-107**: THE SYSTEM SHALL extraer links entre notas desde `content_md` y
  persistirlos en `ext_ka_note_links` (`source_note_id`, `target_note_id`).
- **FR-108**: THE SYSTEM SHALL exponer endpoints CRUD para notas:
  `POST/GET/PATCH/DELETE /api/knowledge/notes`.
- **FR-109**: THE SYSTEM SHALL exponer `GET /api/knowledge/graph` retornando
  `{ nodes: Note[], edges: NoteLink[] }` para el visor grafo.
- **FR-110**: THE SYSTEM SHALL filtrar todas las queries de notas por
  `user_id` (ownership).

### Visores (FR-201 a FR-207)

- **FR-201**: THE SYSTEM SHALL proveer un visor árbol que renderice la
  jerarquía `category_path` con expandir/colapsar.
- **FR-202**: WHEN el usuario click en una nota del árbol THEN THE SYSTEM SHALL
  abrir el editor TipTap con su contenido.
- **FR-203**: THE SYSTEM SHALL proveer un visor grafo con `d3-force` sobre SVG
  usando `forceLink`, `forceManyBody`, `forceCollide`, `forceX`, `forceY`.
- **FR-204**: THE SYSTEM SHALL escalar el radio de nodos según su degree
  (número de conexiones).
- **FR-205**: WHEN el usuario hace hover sobre un nodo THEN THE SYSTEM SHALL
  highlight vecinos y dim el resto.
- **FR-206**: WHEN el usuario selecciona un nodo THEN THE SYSTEM SHALL mostrar
  un panel lateral con título, tags y backlinks (vínculos bidireccionales).
- **FR-207**: THE SYSTEM SHALL soportar zoom y pan del grafo con `d3-zoom`, y
  drag para fijar posición de nodos.

### DeepAgent runtime (FR-301 a FR-310)

- **FR-301**: THE SYSTEM SHALL implementar `build_agent(agent_config_id,
  userId)` como factory que carga `systemPrompt`, tools y model desde DB.
- **FR-302**: THE SYSTEM SHALL persistir configs de agente en
  `ext_ka_agent_configs` (`name`, `system_prompt`, `model`, `provider`,
  `permissions` jsonb, `mcp_servers` jsonb).
- **FR-303**: THE SYSTEM SHALL hacer auto-discovery de `agent.tools.ts` en
  cada extensión y mergearlas en el agente como array unificado.
- **FR-304**: THE SYSTEM SHALL cargar MCP servers externos desde
  `ext_ka_mcp_servers` usando `MultiServerMCPClient` y mergear sus tools.
- **FR-305**: THE SYSTEM SHALL ejecutar comandos del agente en sandbox Node
  VFS con working dir aislado por session.
- **FR-306**: THE SYSTEM SHALL aplicar permisos declarativos allow/deny con
  glob paths en el sandbox (deny a `.env`, creds y código del proyecto).
- **FR-307**: THE SYSTEM SHALL proveer `isolated-vm` para eval liviano (math,
  loops, scripts) sin acceso a shell/network.
- **FR-308**: THE SYSTEM SHALL aceptar model string configurable por agente
  (`"ollama:X"` o `"openrouter:Y"`) y reconstruir el agente al cambiar.
- **FR-309**: THE SYSTEM SHALL cachear el agente construido por config hash y
  reutilizarlo si el hash no cambió.
- **FR-310**: THE SYSTEM SHALL reconstruir el agente por request cuando el
  config hash cambió (invalidate cache).

### Agent KB tools (FR-401 a FR-406)

- **FR-401**: THE SYSTEM SHALL proveer la tool `search_notes_tree(categoryPath,
  depth)` para tree search por niveles.
- **FR-402**: THE SYSTEM SHALL proveer la tool `search_notes_semantic(query,
  topK)` para RAG con pgvector (opt-in).
- **FR-403**: THE SYSTEM SHALL proveer la tool `create_note(title, content_md,
  category_path, tags?)` que genera embedding automáticamente.
- **FR-404**: THE SYSTEM SHALL proveer la tool `update_note(note_id,
  content_md?, category_path?, tags?)` que re-embedda si `content_md` cambia.
- **FR-405**: WHEN el agente invoca `delete_note(note_id)` THEN THE SYSTEM SHALL
  realizar soft delete y registrar auditoría (`deleted_by`).
- **FR-406**: WHEN una nota se crea o actualiza THEN THE SYSTEM SHALL
  regenerar su embedding y re-extractar `note_links`.

### Chat (FR-501 a FR-510)

- **FR-501**: THE SYSTEM SHALL persistir sesiones de chat en
  `ext_ka_chat_sessions` (`id`, `agent_config_id`, `user_id`, `title`,
  `created_at`, `updated_at`).
- **FR-502**: THE SYSTEM SHALL incluir `user_id` en todas las queries de
  sesiones y verificar ownership en cada endpoint.
- **FR-503**: IF el `user_id` del request no matchea el `user_id` de la sesión
  THEN THE SYSTEM SHALL retornar 403 Forbidden.
- **FR-504**: THE SYSTEM SHALL usar `PostgresSaver` checkpointer de LangGraph
  para persistencia de sesiones.
- **FR-505**: THE SYSTEM SHALL hacer streaming de respuestas vía SSE
  (`stream_events v3`) desde NestJS hacia Nuxt.
- **FR-506**: THE SYSTEM SHALL renderizar mensajes con `markdown-it` +
  `highlight.js` + `DOMPurify` (código, HTML, markdown).
- **FR-507**: THE SYSTEM SHALL listar sesiones del usuario autenticado (`GET
  /api/knowledge/chat/sessions`).
- **FR-508**: WHEN el usuario reanuda una sesión THEN THE SYSTEM SHALL cargar
  historial previo desde `PostgresSaver` y continuar el hilo.
- **FR-509**: THE SYSTEM SHALL correr el agente con `userId` en el state de
  LangGraph para que sus tools operen en scope del usuario.
- **FR-510**: THE SYSTEM SHALL permitir al usuario crear y titular sesiones
  nuevas.

### Config (FR-601 a FR-605)

- **FR-601**: THE SYSTEM SHALL persistir proveedores en
  `ext_ka_model_providers` (`name`, `provider` enum `ollama|openrouter`,
  `api_key_ref`, `base_url`, `enabled`).
- **FR-602**: THE SYSTEM SHALL persistir modelos en `ext_ka_models`
  (`provider_id`, `model_id`, `display_name`, `context_window`, `active`).
- **FR-603**: WHEN el admin cambia modelo de un agente THEN THE SYSTEM SHALL
  reconstruir el agente con el nuevo model string en el siguiente request.
- **FR-604**: WHEN el admin cambia proveedor de un agente THEN THE SYSTEM SHALL
  reconstruir el agente con el nuevo model string.
- **FR-605**: THE SYSTEM SHALL guardar API keys como `api_key_ref` (referencia
  a env var o secret store), nunca como valor plano en DB.

### RBAC (FR-701 a FR-703)

- **FR-701**: THE SYSTEM SHALL aplicar permisos por rol sobre endpoints de
  notas, chat y config.
- **FR-702**: THE SYSTEM SHALL aislar sesiones por usuario: ningún usuario
  accede a sesiones ajenas.
- **FR-703**: THE SYSTEM SHALL permitir a admin gestionar configs de agente,
  modelos, proveedores y MCP servers.

## Requisitos no funcionales (NFR)

- **NFR-01 (performance)**: WHEN el agente inicia streaming THEN THE SYSTEM
  SHALL emitir el primer token en < 100 ms.
- **NFR-02 (performance)**: THE SYSTEM SHALL mantener el visor grafo a ≥ 30 FPS
  hasta 500 nodos.
- **NFR-03 (performance)**: THE SYSTEM SHALL usar index IVFFlat o HNSW en
  pgvector para búsqueda semántica.
- **NFR-04 (seguridad)**: THE SYSTEM SHALL aislar comandos del agente en
  sandbox Node VFS con permisos declarativos y working dir aislado.
- **NFR-05 (seguridad)**: THE SYSTEM SHALL denegar acceso a `.env`, credenciales
  y código del proyecto desde el sandbox.
- **NFR-06 (escalabilidad)**: THE SYSTEM SHALL soportar KB interna < 10k notas
  con pgvector sin degradación.
- **NFR-07 (observabilidad)**: THE SYSTEM SHALL usar NestJS `Logger` (no
  `console.log`) para todos los logs del módulo.
- **NFR-08 (observabilidad)**: THE SYSTEM SHALL registrar `build_agent` cache
  hits/misses para observabilidad.
- **NFR-09 (calidad)**: THE SYSTEM SHALL tener ≥ 80% cobertura de tests en el
  módulo extensión (backend, strict TDD).
- **NFR-10 (convención)**: THE SYSTEM SHALL usar prefijo `ext_ka_` en todas las
  tablas de la extensión.