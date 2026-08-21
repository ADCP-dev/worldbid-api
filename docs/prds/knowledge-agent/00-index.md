---
doc: knowledge-agent/00-index
title: "Knowledge Agent — PRD Index"
status: draft
created: 2026-08-21
---

# PRD: Knowledge Agent Extension — Index

## Resumen

PRD multi-file para la extensión **knowledge-agent** de Foundation Mono. Cubre una knowledge base en markdown viviente en PostgreSQL (con embedding pgvector para RAG), un DeepAgent con `deepagents` npm (agente único que acumula tools de todas las extensiones, agent.md dinámico en DB, sandbox de comandos aislados, MCPs externos configurables, modelo/proveedor configurable en DB), chat con sesiones persistentes estilo ChatGPT (streaming SSE, render rich), y visores estilo Obsidian (árbol jerárquico + grafo de nodos/links/backlinks).

## Estado

- **status**: draft
- **owner**: [NEEDS CLARIFICATION]
- **created**: 2026-08-21
- **input**: brief del usuario + investigación técnica (`deepagents` npm, OpenWiki OKF, langchainjs PGVectorStore, PostgresSaver, MultiServerMCPClient)

## Tabla de contenidos

| # | Archivo | Contenido |
|---|---------|-----------|
| 00 | `00-index.md` | Este archivo |
| 01 | `01-overview.md` | Problema, objetivos, no-objetivos, KPIs |
| 02 | `02-architecture.md` | Arquitectura propuesta (7 componentes), flujo, diagramas |
| 03 | `03-requirements.md` | FR-NNN (EARS) + NFR-NNN |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos y trade-offs |
| 06 | `06-migration-phases.md` | Fases de implementación incremental |
| 07 | `07-open-questions.md` | Q-NNN pendientes |
| 08 | `08-definition-of-done.md` | Criterios de cierre |

## Componentes base-ui referenciados

Del catálogo `@base/ui-app/components/`:

| Componente | Uso en knowledge-agent |
|------------|-------------------------|
| `FormInput` | Form notas (título), form MCP server (name, url) |
| `FormTextArea` | Form notas (descripción), agent.md editor |
| `FormSelect` | Selector de modelo, provider, categoría de nota |
| `FormSwitch` | Toggle nota publicada, toggle MCP enabled |
| `DataTable` | Lista notas, lista sesiones de chat, lista MCP servers |
| `RichEditor` | Editor TipTap para content_md de notas |

## Flujo posterior

```
este PRD → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```