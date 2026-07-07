---
doc: cms-audit/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## Requisitos funcionales (FR-NNN)

### Dashboard

**FR-001 — Dashboard de auditoría**
THE SYSTEM SHALL render una página `/app/cms/audit` con KPI cards (`StatCard` FR-001 base) para: páginas auditadas, gaps totales, score promedio, fecha última run.
WHEN no existe run previa THE SYSTEM SHALL mostrar empty-state con CTA "Lanzar primera auditoría".

**FR-002 — Score global (Gauge)**
THE SYSTEM SHALL render un `GaugeChartCard` (FR-005 base) con el score promedio 0-100% del CMS en la última run.
WHEN score >= 80 THE SYSTEM SHALL colorear arc success; IF 50-79 warning; ELSE error.

**FR-003 — Gaps por tipo (Bar)**
THE SYSTEM SHALL render un `BarChartCard` (FR-003 base) con cantidad de findings por tipo de check (SEO meta, JSON-LD, traducciones, hreflang, canonical, OG image, robots, sitemap, tabla vieja, hardcodes).
WHEN una barra se clickea THE SYSTEM SHALL navegar al detalle de run filtrado por ese tipo.

**FR-004 — Distribución por severidad (Donut)**
THE SYSTEM SHALL render un `DonutChartCard` (FR-004 base) con distribución de findings por severidad (critical / warning / info).
THE SYSTEM SHALL mostrar legend con conteos absolutos y porcentajes.

**FR-005 — Tendencia histórica**
THE SYSTEM SHALL render un `TrendChart` (FR-002 base) con la evolución del score promedio entre las últimas N runs (default 12).
IF solo existe 1 run THE SYSTEM SHALL mostrar mensaje "sin histórico suficiente".

**FR-006 — Tabla de últimas findings**
THE SYSTEM SHALL render un `DataTable` con las últimas 50 findings ordenadas por severidad y fecha, con columnas: tipo, severidad, página afectada, run date, acción (ver detalle).

### Forms automatizados

**FR-010 — Formulario de creación de run**
THE SYSTEM SHALL render un form `AuditRunForm` con:
- `LinkedSelect` (FR-011 base): A = `cms target` (solo "cms" hoy, preparado para multi-cms futuro), B = `audit profile` (full / seo-only / i18n-only / sitemap-only) — las options de B dependen de A.
- `scope` selector: todas las páginas | sección específica (`section` enum: landing|blog|documentation|store).
- `checks` auto-seleccionados según `audit profile`: WHEN profile=seo-only THE SYSTEM SHALL pre-marcar checks SEO y desactivar el resto.

**FR-011 — Auto-config de checks**
WHEN `audit profile` cambia THE SYSTEM SHALL actualizar la lista de checks habilitados sin intervención manual.
IF profile=`i18n-only` THE SYSTEM SHALL seleccionar solo `translations-complete` y `hreflang-valid`.

**FR-012 — Lanzar run on-demand**
WHEN operador confirma el form THE SYSTEM SHALL POST a `/api/v1/cms-audit/runs` con `{profile, scope, checks}` y redirigir a `/cms/audit/runs/:id` mostrando progreso.

### Scheduling

**FR-020 — Schedule editor**
THE SYSTEM SHALL render un `CronScheduleEditor` (FR-006 base) en el form de creación, modo `weekly` por defecto (audits semanales).
THE SYSTEM SHALL exponer `WeekdayPicker` (FR-007) y `CronNextRunsPreview` (FR-009) cuando el operador alterna "Auditoría recurrente".
WHEN "Auditoría on-demand" está seleccionado THE SYSTEM SHALL ocultar el bloque de scheduling.

**FR-021 — Persistencia de schedule**
WHEN operador guarda un schedule recurrente THE SYSTEM SHALL POST a `/api/v1/cms-audit/runs/schedule` con el cron string y el profile.
THE SYSTEM SHALL registrar el cron dinámicamente con `@nestjs/schedule` `SchedulerRegistry` y persistirlo en `ext_cms_audit_run_config`.

### Backend endpoints

**FR-030 — POST /api/v1/cms-audit/runs**
THE SYSTEM SHALL aceptar `{profile: string, scope: {section?: string}, checks?: string[]}` y crear una `AuditRun` con status `pending`, encolar job en BullMQ, retornar 202 con `{runId}`.

**FR-031 — GET /api/v1/cms-audit/runs**
THE SYSTEM SHALL retornar lista paginada de runs ordenadas por `createdAt DESC` con `{id, status, scoreAvg, findingsCount, createdAt, completedAt}`.

**FR-032 — GET /api/v1/cms-audit/runs/:id**
THE SYSTEM SHALL retornar detalle de run incluyendo findings agregados por tipo y severidad.

**FR-033 — GET /api/v1/cms-audit/dashboard**
THE SYSTEM SHALL retornar DTO agregado para el dashboard: KPIs, score, distribución por tipo y severidad, tendencia últimas 12 runs, últimas findings.

**FR-034 — GET /api/v1/cms-audit/runs/:id/findings**
THE SYSTEM SHALL retornar findings paginadas con filtros por `type`, `severity`, `pageId`.

**FR-035 — POST /api/v1/cms-audit/runs/schedule**
THE SYSTEM SHALL aceptar `{cron: string, profile: string, scope: object}` y registrar el cron dinámico.

**FR-036 — DELETE /api/v1/cms-audit/runs/schedule/:id**
THE SYSTEM SHALL desactivar y eliminar el schedule persistido y desregistrarlo del `SchedulerRegistry`.

### RBAC

**FR-040 — Permisos**
THE SYSTEM SHALL requerir permiso `cms-audit:read` para endpoints GET y `cms-audit:run` para POST/DELETE.
IF usuario sin permiso accede THE SYSTEM SHALL retornar 403.

## Requisitos no funcionales (NFR-NNN)

### NFR-001 — Performance audit
WHEN una audit run procesa > 1000 páginas THE SYSTEM SHALL completar en < 5 minutos.
THE SYSTEM SHALL procesar checks en paralelo por página (Promise.all con concurrencia configurable, default 10).
THE SYSTEM SHALL no bloquear el event loop de NestJS — el trabajo pesado ocurre en el processor BullMQ.

### NFR-002 — Performance dashboard
WHEN dashboard carga THE SYSTEM SHALL responder `GET /dashboard` en < 500ms.
THE SYSTEM SHALL cachear el aggregate de la última run completada (TTL 60s o invalidación al completar run).

### NFR-003 — i18n
THE SYSTEM SHALL sourcear strings de `apps/front/i18n/locales/{es,en}/cms-audit.json` bajo namespace `cms-audit.*`.
THE SYSTEM SHALL traducir: labels de checks, severidades, títulos de dashboard, empty-states, CTAs.

### NFR-004 — Accesibilidad
THE SYSTEM SHALL proveer ARIA roles en todos los componentes del dashboard (cards, charts, tablas).
THE SYSTEM SHALL proveer `aria-label` para GaugeChartCard ("Score del CMS: 75%") y DonutChartCard.

### NFR-005 — Idempotencia de checks
WHEN una misma página se audita dos veces en runs distintas THE SYSTEM SHALL producir el mismo resultado si el contenido no cambió.

### NFR-006 — Retención histórica
THE SYSTEM SHALL retener al menos las últimas 12 runs completas (findings incluidos).
WHEN existen > 12 runs THE SYSTEM SHALL archivar las más viejas (sin borrar, pero fuera del dashboard default).