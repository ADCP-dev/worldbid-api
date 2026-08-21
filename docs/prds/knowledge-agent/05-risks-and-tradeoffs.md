---
doc: knowledge-agent/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-08-21
---

# Riesgos y Trade-offs

## Riesgos técnicos

### R-01 — Sandbox escapa y toca código del proyecto (CRÍTICO)
**Riesgo**: El `execute` tool del DeepAgent ejecuta comandos que acceden a `apps/`, `.env`, creds del proyecto. El agente podría leer secretos o modificar código.
**Probabilidad**: Baja-Media (si permisos declarativos mal configurados).
**Impacto**: Alto — exposición de secrets, modificación de código.
**Mitigación**: FR-402 — deny explícito a `.env`, creds, `apps/`, `packages/`, `src/`. Node VFS en dev aísla del filesystem real. Daytona microVM en prod aísla completamente. Tests de penetración del sandbox en Fase 3.
**Trade-off**: Aislamiento completo = Daytona (costo, latencia). Node VFS en dev es menos seguro pero suficiente para desarrollo.

### R-02 — Embedding latencia alta bloquea save de nota
**Riesgo**: `OllamaEmbeddings` remoto (Ollama Cloud) puede tardar > 2s o timeout. Si el save espera el embedding, UX se degrada.
**Probabilidad**: Media (depende de latencia red + carga Ollama).
**Impacto**: Medio — UX lenta, posible timeout.
**Mitigación**: FR-102 — si embedding falla, persistir nota con `embedding=NULL` y log warning. Re-embeddar async via Bull queue (background job). Nota queda searchable por título/tags pero no por semantic search hasta que embedde.
**Trade-off**: Nota sin embedding no aparece en RAG search. Aceptable temporal.

### R-03 — pgvector no instalado en PostgreSQL
**Riesgo**: `CREATE EXTENSION vector` falla si pgvector no está disponible en el servidor Postgres.
**Probabilidad**: Baja (pgvector es estándar en managed Postgres: RDS, Supabase, Neon).
**Impacto**: Alto — RAG no funciona. Búsqueda semántica no disponible.
**Mitigación**: Migración inicial verifica `pgvector` instalada. Si no → log error claro con instrucciones. Fase 1 (schema) incluye verificación.
**Trade-off**: Sin pgvector, extensión funciona parcialmente (CRUD notas + grafo + chat sin RAG).

### R-04 — deepagents breaking changes (librería joven)
**Riesgo**: `deepagents` v0.7+ es una librería joven. API puede cambiar entre versions. `createDeepAgent` signature puede variar.
**Probabilidad**: Media (librerías < 1.0 suelen tener breaking changes).
**Impacto**: Medio — código de `AgentFactoryService` necesita adaptación.
**Mitigación**: Pin versión exacta en `package.json`. Wrappers en `AgentFactoryService` aislan API de deepagents del resto del código. Tests de integración validan contract.
**Trade-off**: No auto-upgrade. Migración manual cuando se actualiza.

### R-05 — Grafo grande no renderiza (performance frontend)
**Riesgo**: Knowledge base con > 1000 notas → grafo con > 1000 nodos → vue-flow/cytoscape no renderiza fluido.
**Probabilidad**: Media (KB crece con uso).
**Impacto**: Bajo-Medio — UX degradada en grafo, no bloquea funcionalidad.
**Mitigación**: NFR-003 — optimización layout para 500 nodos. Para > 500: paginación visual (clusters), filtro por tag/categoría, lazy loading de nodos. [NEEDS CLARIFICATION: estrategia de cluster — ver Q-12]
**Trade-off**: Grafo completo no visible de una vez para KB grandes. Filtros obligatorios.

### R-06 — MCP server externo caído bloquea build del agente
**Riesgo**: `MultiServerMCPClient` intenta conectar a MCP server caído → timeout → build del agente falla → chat no responde.
**Probabilidad**: Media (MCP servers son externos).
**Impacto**: Medio — chat no funciona hasta que MCP server recupere.
**Mitigación**: NFR-010 — graceful degradation. Timeout corto (3s) en conexión MCP. Si falla, log warning y continuar sin esas tools. Agente se construye con tools restantes.
**Trade-off**: Agente pierde tools del MCP caído. Funcionalidad reducida pero no bloqueada.

### R-07 — Session state corruption (PostgresSaver)
**Riesgo**: `PostgresSaver` checkpointer escribe estado corrupto → sesión no carga → chat history perdido.
**Probabilidad**: Baja (PostgresSaver es robusto).
**Impacto**: Medio — sesión individual corrupta, no todas.
**Mitigación**: PostgresSaver usa tablas propias con esquema controlado. Backup Postgres regular. Si sesión corrupta, crear sesión nueva (no es destructivo).

## Riesgos de seguridad

### R-08 — API keys expuestas (CRÍTICO)
**Riesgo**: `ext_ka_model_providers.api_key_ref` o `ext_ka_mcp_servers.api_key_ref` exponen valores de keys.
**Mitigación**: NFR-006 — DB guarda solo `api_key_ref` (nombre de env var). Keys resueltas desde `process.env` en runtime. Nunca loguear values. Sanitizar responses API (no retornar `api_key_ref` a frontend sin permiso admin). FR-701 — RBAC admin en config endpoints.

### R-09 — Agente ejecuta comando malicioso via sandbox
**Riesgo**: LLM genera comando destructivo (`rm -rf /`, `curl malicious | bash`). Sandbox lo ejecuta.
**Mitigación**: FR-402 — deny a paths críticos. Daytona microVM aísla completamente (filesystem efímero). Node VFS en dev no toca disco real. `isolated-vm` para eval no tiene I/O. Logging de todos los comandos ejecutados (auditoría).
**Trade-off**: Agente no puede modificar proyecto (feature, no bug). Si necesita generar artefactos, los deja en workspace sandbox efímero.

### R-10 — XSS via chat render rich
**Riesgo**: LLM genera HTML malicioso en respuesta → `markdown-it` lo renderiza → XSS en frontend.
**Mitigación**: FR-503 — `DOMPurify` sanitiza todo HTML antes de render. `highlight.js` solo aplica a code blocks (no exec). CSP headers en Nuxt.

## Riesgos de performance

### R-11 — Agent build lento sin cache
**Riesgo**: `build_agent` carga tools de todas las extensiones + MCP servers + model → > 1s por request si no hay cache.
**Mitigación**: FR-301 — cache por config hash. Si config no cambió, reutilizar instancia. NFR-009 — invalidación automática.

### R-12 — RAG search lenta con muchos embeddings
**Riesgo**: `PGVectorStore.similaritySearchWithScore` sobre 10k+ vectores es lento sin índice.
**Mitigación**: NFR-002 — índice IVFFlat o HNSW en `ext_ka_notes.embedding`. Migración crea índice. < 500ms para 10k notas.

## Trade-offs decididos

### T-01 — pgvector vs Qdrant externo
**Decisión**: pgvector en PostgreSQL.
**Sacrificado**: Qdrant tiene mejor performance para millones de vectores.
**Ganado**: No añade infra obligatoria. Postgres ya está. Una DB menos.
**Por qué**: YAGNI. KB interna < 100k notas. pgvector suficiente.

### T-02 — deepagents npm vs custom agent harness
**Decisión**: `deepagents` npm.
**Sacrificado**: Menos control sobre internals. Dep de librería joven (R-04).
**Ganado**: Planning, filesystem, memory, MCP integration out-of-the-box. No reinventar rueda.
**Por qué**: CONCEPTOS > CÓDIGO. deepagents encapsula best practices de LangGraph.

### T-03 — Agente único vs orquestador + subagentes
**Decisión**: Agente único con tools de extensiones.
**Sacrificado**: Paralelismo, especialización de subagentes.
**Ganado**: Simplicidad. Una sola config. Un solo system prompt. Menos latencia (no coordination overhead).
**Por qué**: Requisito explícito del usuario. Tools de extensiones dan especialización sin multi-agente.

### T-04 — SSE vs WebSocket para streaming
**Decisión**: SSE (Server-Sent Events).
**Sacrificado**: Bidireccionalidad (WebSocket). SSE es unidireccional server→client.
**Ganado**: Simplicidad. SSE es HTTP estándar. No necesita upgrade handshake. Mejor con proxies/CDN.
**Por qué**: Chat streaming es unidireccional (server→client). Input del user va via POST normal.

### T-05 — Agent.md en DB vs archivo fijo
**Decisión**: `ext_ka_agent_configs.system_prompt` en DB.
**Sacrificado**: Versionado git del prompt (no está en repo).
**Ganado**: Editable sin deploy. Dinámico. Multi-config (varios agentes con prompts diferentes).
**Por qué**: Requisito explícito del usuario. Modificable desde frontend admin.

### T-06 — PostgresSaver vs Redis checkpointer
**Decisión**: PostgresSaver.
**Sacrificado**: Redis sería más rápido para checkpoint writes.
**Ganado**: Persistencia durable. Sobrevive restarts. No añade dep Redis obligatoria.
**Por qué**: Sesiones de chat deben persistir. Postgres ya está.

### T-07 — Node VFS (dev) + Daytona (prod) vs Modal serverless
**Decisión**: Node VFS dev + Daytona prod.
**Sacrificado**: Modal puede ser más simple para serverless (no manejar microVM lifecycle).
**Ganado**: Daytona da aislamiento completo con filesystem efímero. Control total.
**Por qué**: Daytona alineado con deepagents SandboxBackend. Modal como alternativa abierta (Q-04).