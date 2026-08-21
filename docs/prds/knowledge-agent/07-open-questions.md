---
doc: knowledge-agent/07-open-questions
title: "Open Questions"
status: draft
created: 2026-08-21
---

# Open Questions

## Q-01 — ¿Multi-agente en el futuro?

**Pregunta**: El PRD especifica agente único (no orquestador + subagentes). ¿Se contempla multi-agente para v2? Si sí, ¿la arquitectura de `build_agent` + tools de extensiones es compatible con evolucionar a supervisor?

**Impacto**: No bloqueante para v1. Arquitectura de tools de extensiones (FR-305) es compatible — un supervisor consumiría las mismas tools. `AgentFactoryService` podría construir supervisor en v2.
**Recomendación**: No en v1. Arquitectura deja puerta abierta. Si surge necesidad, `langgraph-supervisor` npm es el path (no verificado en JS — ver investigación técnica).

---

## Q-02 — ¿Tomar más de OpenWiki que el formato OKF?

**Pregunta**: Solo tomamos el formato OKF (YAML frontmatter) de OpenWiki. ¿Vale la pena reusar algo más? ¿El visualizer de OpenWiki tiene patrones útiles para el grafo?

**Impacto**: No bloqueante. OpenWiki es CLI, no lib embebible.
**Recomendación**: Solo OKF. Visualizer de OpenWiki es local/CLI — no reutilizable. Nuestro grafo (vue-flow/cytoscape) es web-based.

---

## Q-03 — ¿Multi-tenant knowledge bases?

**Pregunta**: ¿Cada tenant/usuario tiene su propia KB, o es una KB compartida para todo el equipo?

**Impacto**: No bloqueante para v1 (asumido single shared KB). Si multi-tenant: `ext_ka_notes` necesita `tenant_id` o `user_id` + RLS. Busquedas RAG filtradas por tenant.
**Recomendación**: Single shared KB en v1. Si surge multi-tenant, añadir `owner_id` + filtros. No arquietctura bloqueante para migrar.

---

## Q-04 — ¿Daytona o Modal para sandbox prod?

**Pregunta**: D-07 propone Daytona (microVM) para prod. Modal (serverless) es alternativa. ¿Cuál? Diferencias: Daytona = microVM persistente, más control. Modal = serverless, scale-to-zero, menos infra.

**Impacto**: Bloqueante para Fase 3 (sandbox prod). Dev usa Node VFS (no bloqueante).
**Recomendación**: Daytona — alineado con deepagents SandboxBackend. Modal como fallback si Daytona no es viable (costo, availability). Evaluar en Fase 3.

---

## Q-05 — ¿vue-flow o cytoscape para visor de grafo?

**Pregunta**: Ambos renderizan grafos en Vue. vue-flow es más Vue-nativo (composables, reactividad). cytoscape es más maduro, más features de layout, pero menos Vue-friendly (wrapper needed).

**Impacto**: Bloqueante para Fase 3 (grafo frontend). Performance similar para < 1000 nodos.
**Recomendación**: vue-flow — más idiomático en ecosistema Vue 3 + Nuxt. Si performance insuficiente > 1000 nodos, evaluar cytoscape con `vue-cytoscape` wrapper.

---

## Q-06 — ¿OpenAI y Anthropic en v1?

**Pregunta**: FR-304 soporta Ollama Cloud + OpenRouter. ¿Añadir OpenAI y Anthropic como providers directos en v1? langchainjs los soporta.

**Impacto**: No bloqueante. OpenRouter ya da acceso a OpenAI y Anthropic models indirectamente.
**Recomendación**: No en v1. OpenRouter cubre OpenAI/Anthropic models. Añadir providers directos en v2 si se necesita (solo añadir enum + integration).

---

## Q-07 — Alias frontend `@ka` vs `@knowledge-agent`

**Pregunta**: Convención de alias frontend para la extensión. Otros usan `@stripe`, `@cms`, `@crm` (nombres cortos). `@ka` es corto pero poco descriptivo. `@knowledge-agent` es largo.

**Impacto**: No bloqueante pero afecta todos los imports frontend.
**Recomendación**: `@ka` — consistente con prefijo de tablas `ext_ka_` y nombres cortos de otras extensiones. Documentar en `nuxt.config.ts`.

---

## Q-08 — Compatibilidad deepagents con Node.js del proyecto

**Pregunta**: `deepagents` v0.7+ requiere Node.js 18+ (LangChain JS). ¿Qué versión de Node usa el proyecto? ¿Hay restricciones de runtime?

**Impacto**: Bloqueante para Fase 4 (agent). Si Node < 18, deepagents no funciona.
**Recomendación**: Verificar `engines` en `apps/back/package.json` + `.nvmrc`. Si Node < 18, actualizar runtime o evaluar alternativa.

---

## Q-09 — Nombres exactos de paquetes npm LangChain

**Pregunta**: Varios paquetes LangChain referenciados. Nombres exactos a verificar:
- `@langchain/mcp-adapters` — ¿existe con ese nombre? ¿O es `@langchain/langchain-mcp-adapters`?
- `@langchain/langgraph-checkpoint-postgres` — ¿nombre exacto de PostgresSaver?
- `@langchain/community` — ¿incluye PGVectorStore + OllamaEmbeddings?

**Impacto**: Bloqueante para Fase 4. Nombres incorrectos = import failures.
**Recomendación**: Verificar en npm registry antes de Fase 4. Context7 puede resolver docs actualizadas.

---

## Q-10 — Ollama Cloud URL y API

**Pregunta**: ¿Cuál es la URL base exacta de Ollama Cloud? `https://api.ollama.cloud` es asumido. ¿La API es compatible con `OllamaEmbeddings` de langchainjs? ¿Requiere API key?

**Impacto**: Bloqueante para Fase 2 (embedding) y Fase 4 (model). Si URL o API differ, configuración de provider necesita ajuste.
**Recomendación**: Verificar docs de Ollama Cloud. Configurar `base_url` en `ext_ka_model_providers` para flexibilidad.

---

## Q-11 — isolated-vm native addon installable?

**Pregunta**: `isolated-vm` es un native addon de Node (QuickJS). Requiere build tools (python, make, g++). ¿El entorno de deploy tiene build tools? Si no, ¿fallback a `vm` module de Node (menos seguro)?

**Impacto**: No bloqueante (fallback `vm` existe). Pero `vm` es menos seguro (no es true isolation).
**Recomendación**: Intentar `isolated-vm`. Si build falla en deploy, fallback a `vm` con warning de seguridad. Documentar en constraints.

---

## Q-12 — Estrategia de cluster para grafo grande

**Pregunta**: R-05 menciona > 500 nodos. ¿Estrategia de cluster? Opciones: (a) clusters por tag (agrupar notas con mismo tag), (b) paginación visual (mostrar 100 nodos, scroll para ver más), (c) filtro por tag/categoría obligatorio, (d) fisheye/zoom.

**Impacto**: No bloqueante para v1 (NFR-003 cubre 500 nodos). Bloqueante para escala > 1000.
**Recomendación**: Filtro por tag/categoría obligatorio para > 500 nodos. Sin filtro, mostrar solo top-100 por relevance. Cluster visual como v2.

---

## Q-13 — ¿Bull queue para embedding async?

**Pregunta**: R-02 propone embedding async via Bull si sync falla. Bull ya está en el monorepo. ¿Usar Bull para todos los embeddings (siempre async) o solo como fallback?

**Impacto**: No bloqueante. Si siempre async, UX más rápida (save retorna antes de embedding). Si fallback, save espera embedding con timeout.
**Recomendación**: Siempre async via Bull. Save retorna inmediatamente. Nota con `embedding=NULL` hasta que job complete. Search excluye notas sin embedding. Frontend muestra indicador "embedding pendiente".