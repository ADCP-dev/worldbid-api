---
doc: knowledge-agent/00-index
title: "Knowledge Agent — PRD Índice"
status: draft
created: 2026-08-21
---

# Knowledge Agent — PRD Índice

> PRD de la extensión `knowledge-agent` de Foundation. Convierte Foundation en un
> "Obsidian en base de datos" potenciado por un DeepAgent de LangChain.

## Resumen

Extensión `knowledge-agent` que convierte Foundation en un **Obsidian en base de
datos** potenciado por un DeepAgent de LangChain:

- **Knowledge base** en PostgreSQL + pgvector: notas markdown, categorías
  jerárquicas (`frontend/frameworks/react`), tags transversales, frontmatter
  formato OKF, embeddings vectoriales para RAG.
- **Editor TipTap** que serializa a markdown y guarda en DB.
- **Visores** árbol (jerarquía de categorías) + grafo (d3-force sobre SVG, con
  zoom/pan, hover, selección, backlinks).
- **Chat** con sesiones por usuario estilo ChatGPT, streaming SSE, render rich
  (`markdown-it` + `highlight.js` + `DOMPurify`).
- **DeepAgent** (`deepagents` npm) con comandos aislados en sandbox Node VFS
  (dev + prod), `agent.md` dinámico cargado desde DB, tools nativas de
  extensiones (auto-discovery) + MCP externos configurables, modelo y proveedor
  configurables por agente en DB (Ollama Cloud + OpenRouter).

El agente es **knowledge manager**: crea, edita y elimina notas, no solo las
lee. RAG es opt-in: el agente decide cuándo buscar vía tools (no se hace
RAG automático sobre cada query).

## Estado

- **draft** — en revisión, decisiones tomadas, listo para alimentar SDD.
- **Owner**: equipo Foundation.
- **Creado**: 2026-08-21.

## Tabla de contenidos

| #   | Archivo                      | Contenido                                                |
|-----|------------------------------|----------------------------------------------------------|
| 00  | `00-index.md`                | Este índice + resumen + estado                           |
| 01  | `01-overview.md`             | Problema, objetivos, no-objetivos, KPIs                   |
| 02  | `02-architecture.md`          | 8 componentes, diagrama de flujo, paths propuestos       |
| 03  | `03-requirements.md`          | Requisitos funcionales (EARS) + no funcionales            |
| 04  | `04-context.md`              | Stack, dependencias, convenciones, constraints, supuestos|
| 05  | `05-risks-and-tradeoffs.md`   | Riesgos técnicos + trade-offs decididos                  |
| 06  | `06-migration-phases.md`      | 6 fases incrementales + diagrama de orden                |
| 07  | `07-open-questions.md`        | Preguntas resueltas + abiertas                           |
| 08  | `08-definition-of-done.md`    | Checklist por fase + globales                             |

## Flujo del PRD

Este PRD es **input** para `sdd-explore` y `sdd-propose`. No reemplaza el spec
SDD. Es el documento de requisitos de alto nivel que alimenta el proceso SDD:

```
prd-writer (PRD) → sdd-explore → sdd-propose → sdd-spec → sdd-design
                  → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```