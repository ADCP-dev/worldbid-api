---
doc: content-pipeline/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## Requisitos funcionales (FR-CP-NNN)

### Dashboards operativos

#### FR-CP-001 — StatCard KPIs operativos
THE SYSTEM SHALL render ≥6 `StatCard` (FR-001) en la página dashboard operativo: items en cola (waiting), items activos (active), completados últimas 24h, fallidos últimas 24h, throughput (items/hora), latencia p50 end-to-end (segundos).
WHEN un KPI no tiene data THE SYSTEM SHALL mostrar `StatCard` con `value=0` y `description="Sin data"`.
IF `loading` THE SYSTEM SHALL mostrar skeleton en cada `StatCard`.

#### FR-CP-002 — TrendChart throughput temporal
THE SYSTEM SHALL render un `TrendChart` (FR-002) con series temporales de throughput (items completados por hora) en las últimas 24h.
WHEN `mode="area"` THE SYSTEM SHALL rellenar el área bajo la línea.
IF no hay snapshots THE SYSTEM SHALL mostrar empty-state.

#### FR-CP-003 — BarChartCard tiempo por stage + top fuentes
THE SYSTEM SHALL render un `BarChartCard` (FR-003) con tiempo promedio por stage (research, generate, draft, publish) en segundos.
THE SYSTEM SHALL render un segundo `BarChartCard` con top 10 fuentes de ideas (manual, ai_research, trend, competitor_analysis) por conteo.
WHEN `orientation="horizontal"` THE SYSTEM SHALL usar barras horizontales para stage.

#### FR-CP-004 — DonutChartCard distribución de status
THE SYSTEM SHALL render un `DonutChartCard` (FR-004) con distribución de status de drafts (draft, in_review, approved, publishing, published, rejected).
WHEN un segmento es hover THE SYSTEM SHALL mostrar tooltip con valor absoluto y porcentaje.

#### FR-CP-005 — GaugeChartCard success rate
THE SYSTEM SHALL render un `GaugeChartCard` (FR-005) con success rate = (jobs completed / jobs total) × 100 en las últimas 24h.
WHEN `value >= 95` THE SYSTEM SHALL colorear arc success.
WHEN `value < 80` THE SYSTEM SHALL colorear arc error.
THE SYSTEM SHALL aceptar `unit="%"`.

### Forms automatizados

#### FR-CP-010 — Auto-suggest de steps según contentType
WHEN el usuario selecciona `contentType` en el form de crear/editar idea THE SYSTEM SHALL auto-suggest steps preconfigurados desde un catálogo estático mapeado por `contentType`.
THE SYSTEM SHALL permitir al usuario aceptar, modificar o rechazar los steps sugeridos.
IF no existe template para el `contentType` THE SYSTEM SHALL no sugerir nada y dejar vacío.

#### FR-CP-011 — Auto-fill de config desde template
WHEN el usuario selecciona un template de pipeline THE SYSTEM SHALL auto-rellenar campos de config (`keywords`, `brandVoice`, `targetAudience`) desde el template.
THE SYSTEM SHALL marcar visualmente los campos auto-rellenados para que el usuario sepa que puede editarlos.

#### FR-CP-014 — LinkedSelect source + destination
THE SYSTEM SHALL render un `LinkedSelect` (FR-011) en el form de crear/editar project para encadenar source (tipo de fuente: blog, instagram, tiktok, pinterest) → destination (plataforma destino filtrada por source).
WHEN source cambia THE SYSTEM SHALL resetear destination y recomputar opciones.
IF `autoFill=true` y queda 1 opción de destination THE SYSTEM SHALL auto-seleccionarla.

#### FR-CP-015 — KeyValueEditor para config de steps
THE SYSTEM SHALL render un `KeyValueEditor` (FR-010) para que el operador edite config de steps del pipeline (pares key-value: `model`, `tokensLimit`, `imageCount`, `transitionType`, `slideDurationSec`).
THE SYSTEM SHALL aceptar `valueType: 'string' | 'number' | 'boolean'` según el step.
IF una key se duplica THE SYSTEM SHALL marcar inválido y emitir `error`.

### Scheduling

#### FR-CP-020 — CronScheduleEditor para pipelines recurrentes
THE SYSTEM SHALL render un `CronScheduleEditor` (FR-006) en la página `schedules.vue` para configurar pipelines recurrentes por project.
THE SYSTEM SHALL soportar modos `minutes`, `daily`, `weekly`, `monthly`, `advanced`.
WHEN modo `weekly` THE SYSTEM SHALL componer `WeekdayPicker` (FR-007) + time input.
THE SYSTEM SHALL persistir el cron string en `ext_cp_project.scheduleCron` (nueva columna).
IF cron no parsea a modo conocido THE SYSTEM SHALL fallback a `advanced`.

#### FR-CP-021 — CronNextRunsPreview
THE SYSTEM SHALL render un `CronNextRunsPreview` (FR-009) mostrando las próximas 5 ejecuciones del cron configurado.
WHEN cron es inválido THE SYSTEM SHALL mostrar error y no computar.
THE SYSTEM SHALL usar timezone del navegador por defecto + prop override.

#### FR-CP-022 — Activar/desactivar schedule por project
THE SYSTEM SHALL permitir activar/desactivar el schedule por project via `FormSwitch`.
WHEN schedule desactivado THE SYSTEM SHALL no encolar jobs automáticos.
WHILE schedule activado THE SYSTEM SHALL encolar un job de research/generate según el cron.

### Endpoints backend

#### FR-CP-030 — GET /content-pipeline/operational-dashboard
THE SYSTEM SHALL exponer `GET /content-pipeline/operational-dashboard` (admin) que retorne: `kpis` (waiting, active, completed24h, failed24h, throughput, latencyP50), `throughputSeries` (24 puntos horarios), `stageTimes` (array por stage), `topSources` (array por source), `draftsByStatus` (array), `successRate` (number 0-100).
THE SYSTEM SHALL proteger con `@Roles(RoleEnum.admin)`.

#### FR-CP-031 — GET /content-pipeline/queue/stats
THE SYSTEM SHALL exponer `GET /content-pipeline/queue/stats` (admin) que retorne counts BullMQ: `waiting`, `active`, `completed`, `failed`, `delayed`, `paused`.
THE SYSTEM SHALL proteger con `@Roles(RoleEnum.admin)`.

#### FR-CP-032 — PATCH /content-pipeline/projects/:id/schedule
THE SYSTEM SHALL exponer `PATCH /content-pipeline/projects/:id/schedule` (admin) con body `{ scheduleCron: string, scheduleEnabled: boolean }`.
IF `scheduleCron` es inválido THE SYSTEM SHALL retornar HTTP 400 con mensaje.
THE SYSTEM SHALL validar sintaxis cron antes de persistir.

### RBAC

#### FR-CP-040 — Todos los endpoints admin-only
THE SYSTEM SHALL proteger todos los endpoints de content-pipeline con `@Roles(RoleEnum.admin)`.
IF un usuario no-admin intenta acceder THE SYSTEM SHALL retornar HTTP 403.

## Requisitos no funcionales (NFR-CP-NNN)

### NFR-CP-001 — Performance dashboard
WHEN el dashboard operativo renderiza THE SYSTEM SHALL responder en < 500ms para datasets de hasta 10.000 snapshots.
THE SYSTEM SHALL cachear `operationalDashboard()` por 60s en memoria (NestJS Cache) para evitar queries repetidas.

### NFR-CP-002 — Queue stats latencia
THE SYSTEM SHALL responder `/queue/stats` en < 100ms (BullMQ counts son O(1)).

### NFR-CP-003 — i18n
THE SYSTEM SHALL sourcear todos los strings user-facing de `apps/front/i18n/locales/{es,en}/content-pipeline.json` bajo namespace `content-pipeline`.
THE SYSTEM SHALL traducir: labels de KPIs, nombres de stages, status de drafts, modos de cron, empty-states.

### NFR-CP-004 — Accesibilidad
THE SYSTEM SHALL proveer ARIA roles en todos los controles interactivos del dashboard y forms.
WHEN user navega con keyboard THE SYSTEM SHALL soportar Tab order en schedules page (cron editor, weekday toggles, preview).
THE SYSTEM SHALL render `<table class="sr-only">` en charts cuando `a11yTable=true`.

### NFR-CP-005 — Resiliencia
WHEN un job de video falla 3 veces THE SYSTEM SHALL marcarlo como `failed` y NO reintentar más.
THE SYSTEM SHALL retener jobs completed 24h, failed 7d (política existente).
WHEN el worker de BullMQ reinicia THE SYSTEM SHALL reanudar jobs `waiting`/`delayed` automáticamente.

### NFR-CP-006 — Backpressure
WHEN la cola `content-pipeline-video` tiene > 50 jobs `waiting` THE SYSTEM SHALL mostrar warning visual en el dashboard (`StatCard` con `description="Cola saturada"`).
IF > 100 jobs `waiting` THE SYSTEM SHALL mostrar alerta crítica (color error en `StatCard`). `[NEEDS CLARIFICATION]` — ver Q-CP-007.

### NFR-CP-007 — Type safety
THE SYSTEM SHALL compartir tipos entre back y front vía `types.ts` alineado con payload real del backend.
THE SYSTEM SHALL eliminar fallbacks `?? 0` por mismatch de contrato en dashboard page.

## Criterios de aceptación (Given/When/Then) — ejemplos

**Dashboard operativo render**:
- GIVEN un admin autenticado
- WHEN navega a `/app/content-pipeline`
- THEN ve ≥6 `StatCard` con KPIs operativos reales (no 0 por mismatch).

**LinkedSelect source→destination**:
- GIVEN form de crear project con `LinkedSelect` source=blog
- WHEN source cambia a instagram
- THEN destination se resetea y muestra opciones filtradas para instagram.

**CronScheduleEditor weekly**:
- GIVEN schedule page con modo `weekly`, days=[1,3], time="09:00"
- WHEN el editor emite `update:cron`
- THEN el cron string es `"0 9 * * 1,3"` y se persiste via `PATCH /projects/:id/schedule`.

**Success rate gauge**:
- GIVEN 100 jobs en 24h, 92 completed, 8 failed
- WHEN el gauge renderiza
- THEN muestra `92%` con arc color warning (threshold 95).