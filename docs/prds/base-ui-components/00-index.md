---
doc: base-ui-components/00-index
title: "PRD — Componentes Base UI para Extensiones"
status: draft
created: 2026-07-07
---

# PRD — Componentes Base UI para Extensiones

## Tabla de contenidos

| # | Archivo | Contenido |
|---|---------|----------|
| 00 | `00-index.md` | Este índice |
| 01 | `01-overview.md` | Resumen ejecutivo, problema, objetivos, KPIs |
| 02 | `02-architecture.md` | Arquitectura `@base/ui-app`, ubicación nuevos componentes, decisiones técnicas |
| 03 | `03-requirements.md` | Requisitos funcionales (FR) y no funcionales (NFR) por componente |
| 04 | `04-context.md` | Stack, convenciones, dependencias, constraints, supuestos |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos y trade-offs técnicos |
| 07 | `07-open-questions.md` | Preguntas abiertas para el equipo |
| 08 | `08-definition-of-done.md` | Criterios de completitud |

> No hay `06-migration-phases.md` porque este PRD describe features nuevas (no migración).

## Estado

- **status**: draft
- **owner**: Product Architect
- **created**: 2026-07-07
- **última actualización**: 2026-07-07

## Alcance

PRD de catálogo de **componentes base UI nuevos** en `@base/ui-app/` que las
extensiones consumirán para construir dashboards informativos, forms
automatizados y configuradores de scheduling legibles.

Es el **PRD 1 de 9** (catálogo compartido). Los 8 PRD restantes (uno por
extensión) referencian los componentes definidos acá.

## Componentes propuestos (14)

| Categoría | Componente |
|-----------|-----------|
| Scheduling | CronScheduleEditor, WeekdayPicker, TimeWindowPicker, KeyValueEditor |
| Dashboard widgets | StatCard, LineChart, BarChart, DonutChart, TimelineList, EmptyState |
| Automation forms | ToggleGroup, RadioCards, JsonSchemaEditor, FieldRelation |

## Cómo leerlo

1. Lee `01-overview.md` para entender el porqué.
2. Lee `02-architecture.md` para entender dónde viven los componentes.
3. `03-requirements.md` es la especificación contractual — los FR son la
   fuente de verdad para implementar (vía SDD-apply).
4. `07-open-questions.md` debe resolverse antes de aprobar el PRD.

## Convenciones del documento

- **FR-NNN**: requisitos funcionales (EARS notation).
- **NFR-NNN**: requisitos no funcionales.
- **Q-NNN**: open questions.
- `[NEEDS CLARIFICATION]`: decisión pendiente.
- Paths citados son rutas concretas del codebase real (no inventadas).