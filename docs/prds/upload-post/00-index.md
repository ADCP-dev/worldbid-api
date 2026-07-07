---
doc: upload-post/00-index
title: "Upload Post — Índice"
status: draft
created: 2026-07-07
---

# Upload Post — Índice del PRD

**Estado**: draft
**Owner**: Foundation
**Creado**: 2026-07-07
**Extensión**: `apps/back/src/extensions/upload-post/`
**Dependencias**: auth (ninguna inter-extensión)
**PRD base de referencia**: `docs/prds/base-ui-components/` (FR-001..FR-021)

## Resumen

PRD para la extensión **Upload Post**: automatización de redes sociales vía la API
[Upload-Post](https://docs.upload-post.com). Publicación multi-plataforma, programación
de posts, dashboards de analytics, AutoDMs, reportes semanales y mensuales. Acceso
admin-only. Hoy la extensión ya existe y funciona; este PRD la eleva a **dashboards
informativos**, **forms automatizados** y **scheduling entendible** consumiendo el
catálogo de componentes base (`@base/ui-app/components/{charts,scheduling,automation}/`).

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 01 | `01-overview.md` | Resumen ejecutivo, problema, objetivos, KPIs, no-objetivos. |
| 02 | `02-architecture.md` | Arquitectura actual, flujo upload→process→schedule→publish, componentes afectados, matriz de uso. |
| 03 | `03-requirements.md` | FR (dashboards, forms automatizados, scheduling, endpoints, RBAC) + NFR. |
| 04 | `04-context.md` | Stack, aliases, dependencias, constraints, supuestos. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos (archivos grandes, formatos, fallos programados, storage) + trade-offs. |
| 07 | `07-open-questions.md` | Q-NNN pendientes de decisión. |
| 08 | `08-definition-of-done.md` | Criterios objetivos para considerar la extensión completa. |

No hay `06-migration-phases.md`: el PRD no refactoriza la arquitectura existente,
la extiende con componentes base UI y nuevos endpoints puntuales. Si surge refactor
estructural, se introduce `06` en una revisión posterior.

## Catálogo de componentes base referenciados

| Componente | FR base | Uso en upload-post |
|------------|---------|--------------------|
| `StatCard` | FR-001 | KPIs dashboard (uploads hoy, programados, publicados, éxito/fallo) |
| `TrendChart` | FR-002 | Tendencia de uploads y reach en el tiempo |
| `BarChartCard` | FR-003 | Uploads por día, reach por plataforma |
| `DonutChartCard` | FR-004 | Distribución de status (pending/processing/success/error) |
| `CronScheduleEditor` | FR-010 | Programar reporte semanal, schedules recurrentes |
| `WeekdayPicker` | FR-011 | Días de publicación recurrente (sub de FR-010) |
| `TimeWindowPicker` | FR-012 | Ventana horaria de publicación |
| `CronNextRunsPreview` | FR-013 | Próximas ejecuciones del cron configurado |
| `LinkedSelect` | FR-021 | Plataforma → página/board/subreddit (destino encadenado) |

`GaugeChartCard` (FR-005) y `KeyValueEditor` (FR-020) NO se consumen aquí salvo
que una open question los justifique.

## Flujo posterior

```
PRD upload-post (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design
  → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```