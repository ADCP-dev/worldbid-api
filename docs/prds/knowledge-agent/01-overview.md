---
doc: knowledge-agent/01-overview
title: "Knowledge Agent — Overview"
status: draft
created: 2026-08-21
---

# Knowledge Agent — Overview

## Resumen ejecutivo

Extensión `knowledge-agent` para Foundation que convierte el monorepo en un
sistema de conocimiento estructurado: notas markdown en PostgreSQL con
embeddings pgvector, editor TipTap, visores árbol + grafo d3-force, y un
DeepAgent de LangChain que gestiona la knowledge base (crear/editar/eliminar),
ejecuta comandos aislados en sandbox Node VFS, y atiende un chat con sesiones
por usuario estilo ChatGPT.

## Problema

Foundation **no tiene sistema de conocimiento estructurado**. El conocimiento
vive en:

- Documentos `.md` sueltos en el repo (`docs/`, `README.md`, notas de
  investigación), **sin estructura** obligatoria, sin búsqueda semántica, sin
  grafo de relaciones entre notas.
- Sin categorías jerárquicas ni tags transversales consistentes.
- Sin un **agente** que consulte, gestione y opere sobre ese conocimiento.
- Sin **chat con IA** que use el knowledge base como contexto.

El conocimiento está fragmentado, no es consultable semánticamente, no hay
relaciones explícitas entre notas (backlinks) y no hay un agente que actúe como
knowledge manager que lo mantenga vivo.

## Objetivos

- **O-1**: Knowledge base en PostgreSQL con notas markdown, categorías
  jerárquicas (`category_path`) y tags transversales (jsonb).
- **O-2**: Editor TipTap que serializa a markdown, guarda en DB, y re-embedda
  al editar.
- **O-3**: Visor árbol (jerarquía de categorías) + visor grafo (d3-force sobre
  SVG, nodos con radio por degree, links, hover/selected/drag, panel lateral
  con backlinks).
- **O-4**: DeepAgent con tools nativas de extensiones (auto-discovery) + MCP
  externos configurables (MultiServerMCPClient).
- **O-5**: DeepAgent con sandbox Node VFS (dev **y** prod) para comandos
  aislados, sin infra externa.
- **O-6**: DeepAgent como **knowledge manager**: crear, editar y eliminar notas
  (no solo leer).
- **O-7**: Chat con sesiones por usuario (aisladas), streaming SSE, render rich
  estilo ChatGPT (`markdown-it` + `highlight.js` + `DOMPurify`).
- **O-8**: Config en DB: modelo, proveedor (Ollama Cloud + OpenRouter),
  `agent.md` dinámico por agente.

## No-objetivos

- **NO** orquestador + subagentes: agente único con tools de extensiones.
- **NO** sandbox externo (Daytona/Modal/E2B): solo Node VFS.
- **NO** guardar `.md` en el repo: todo en PostgreSQL.
- **NO** RAG automático: el agente decide cuándo buscar vía tools.
- **NO** multi-tenant isolation: sesiones por **usuario**, no por tenant.
- **NO** exportar tools vía MCP a agentes externos: tools nativas son
  in-process.

## KPIs / métricas de éxito

| ID  | Métrica                              | Meta                          | Cómo medir                          |
|-----|--------------------------------------|-------------------------------|------------------------------------|
| K-1 | Notas creadas/ediciones vía agente   | ≥ 30% del total de escrituras | Contador en `ext_ka_notes` (`created_by`) |
| K-2 | Latencia primer token en streaming   | < 100 ms                      | Logs del endpoint SSE              |
| K-3 | Cobertura tests backend (estricto)   | ≥ 80% líneas en módulo extensión | `pnpm test:cov`                   |
| K-4 | Aislamiento cross-user verificado     | 0 fugas (403 en todo acceso)  | Test E2E cross-user                 |
| K-5 | Render grafo a 60 FPS                | ≥ 30 FPS hasta 500 nodos       | Lighthouse / perf trace            |
| K-6 | Reconstrucción de agente con cache    | Hit cache ≥ 90% en producción | Métricas de `build_agent`          |
| K-7 | Migración generada (no SQL hardcode) | 100% vía `migration:generate` | Auditoría de PR                     |