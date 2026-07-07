---
doc: cms-audit/00-index
title: "CMS Audit & Gap Analysis — Índice"
status: draft
created: 2026-07-07
---

# CMS Audit & Gap Analysis — Índice

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**PRD base de referencia**: `docs/prds/base-ui-components/` (FR-001..FR-021)
**Parent extension**: `cms`
**Dependencias**: auth, storage, translations, cms

## Resumen

PRD para la extensión **CMS Audit & Gap Analysis** (`apps/back/src/extensions/cms-audit/`), que audita el contenido del CMS (páginas, blog posts, SEO metadata, JSON-LD, hreflang, sitemap) detectando gaps: SEO incompleto, JSON-LD faltante, traducciones ausentes, hardcodes, bugs conocidos. Expone dashboards con score por página, distribución de issues y tendencias históricas; permite lanzar auditorías on-demand o agendadas; consume el catálogo de componentes base UI (`StatCard`, `GaugeChartCard`, `BarChartCard`, `DonutChartCard`, `LinkedSelect`, `CronScheduleEditor`).

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC. |
| 01 | `01-overview.md` | Resumen ejecutivo, problema, objetivos, KPIs, no-objetivos. |
| 02 | `02-architecture.md` | Arquitectura propuesta, flujo de auditoría, componentes afectados, matriz de uso FR-NNN base → acá. Mermaid. |
| 03 | `03-requirements.md` | FR-NNN (dashboard, forms automatizados, scheduling, endpoints backend, RBAC), NFR-NNN. |
| 04 | `04-context.md` | Stack, aliases, dependencias (parent cms), constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Rendimiento, consistencia, false positives, trade-offs. |
| 06 | `06-migration-phases.md` | Fases de implementación incremental (no refactor de cms). |
| 07 | `07-open-questions.md` | Q-NNN pendientes de decisión. |
| 08 | `08-definition-of-done.md` | Criterios objetivos para considerar la extensión completa. |

## Flujo posterior

```
PRD cms-audit (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify
```