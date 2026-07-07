---
doc: autonomous-agent/03-requirements
title: "Autonomous Agent — Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## FR — Dashboard

### FR-101 — KPIs del dashboard
THE SYSTEM SHALL render en `/app/autonomous-agent` los siguientes StatCard: agentes activos, runs hoy, runs totales, tasa de éxito (%), configs totales, costo tokens acumulado, throughput (runs/día promedio), last run (datetime).
WHEN `loading` THE SYSTEM SHALL mostrar skeleton en cada StatCard.
IF un KPI no tiene datos THE SYSTEM SHALL mostrar `—` y tooltip "sin datos".

### FR-102 — TrendChart de runs
THE SYSTEM SHALL render un TrendChart de runs completados vs fallidos por día (últimos 30 días) en `index.vue`.
WHEN `mode="area"` THE SYSTEM SHALL rellenar bajo la línea.
THE SYSTEM SHALL aceptar `height` ≥ 120 para esta vista (no sparkline).

### FR-103 — BarChartCard por runType
THE SYSTEM SHALL render un BarChartCard con distribución de runs por `runType` (research/generate/publish/metrics) del último 30 días.
WHEN `data.length === 0` THE SYSTEM SHALL mostrar empty-state.

### FR-104 — DonutChartCard por status
THE SYSTEM SHALL render un DonutChartCard con distribución de runs por `status` (pending/running/completed/failed).
THE SYSTEM SHALL mostrar leyenda con porcentajes.

### FR-105 — GaugeChartCard de success rate
THE SYSTEM SHALL render un GaugeChartCard con `value` = success rate (%) clamped 0-100.
WHEN `value >= 90` THE SYSTEM SHALL colorear success, `>= 70` warning, `< 70` error.
THE SYSTEM SHALL aceptar `unit="%"`.

### FR-106 — Costo tokens visible
THE SYSTEM SHALL mostrar en `index.vue` un StatCard con costo tokens acumulado (suma de `output.promptTokens + output.completionTokens` de todos los runs `completed`).
THE SYSTEM SHALL mostrar en `[id].vue` un StatCard con costo tokens del config.

### FR-107 — Last run / next run
THE SYSTEM SHALL mostrar en `[id].vue` last run (datetime, status) y next run (datetime calculado desde el cron activo via `cron-parser`).
IF no hay runs previos THE SYSTEM SHALL mostrar "—" en last run.
IF config pausado THE SYSTEM SHALL mostrar "pausado" en next run.

## FR — Forms automatizados

### FR-110 — CronScheduleEditor por phase
THE SYSTEM SHALL render 4 instancias de CronScheduleEditor (FR-010 base) en `create.vue` y `[id].vue`, una por phase: research, generate, publish, metrics.
WHEN el cron actual parsea a un modo conocido THE SYSTEM SHALL activar ese modo.
IF el cron no parsea THE SYSTEM SHALL fallback a `advanced` y emitir warn.

### FR-111 — WeekdayPicker integrado
THE SYSTEM SHALL integrar WeekdayPicker (FR-011 base) dentro de CronScheduleEditor cuando `mode="weekly"` para los 4 phases.
THE SYSTEM SHALL respetar locale del usuario (es/en) para orden L..D vs D..S.

### FR-112 — CronNextRunsPreview por phase
THE SYSTEM SHALL render un CronNextRunsPreview (FR-013 base) bajo cada CronScheduleEditor mostrando las próximas 5 ejecuciones.
WHEN cron inválido THE SYSTEM SHALL mostrar error inline.

### FR-113 — Auto-suggest de templates
THE SYSTEM SHALL proveer un `FormSelect` "Template" con opciones: `daily`, `weekly`, `aggressive`, `custom`.
WHEN se selecciona un template THE SYSTEM SHALL auto-fill los 4 CronScheduleEditor con crons predefinidos:
- `daily`: research `0 9 * * *`, generate `0 10 * * *`, publish `0 18 * * *`, metrics `0 9 * * 1`
- `weekly`: research `0 9 * * 1`, generate `0 10 * * 1`, publish `0 18 * * 1`, metrics `0 9 * * 1`
- `aggressive`: research `0 */4 * * *`, generate `0 1 * * *`, publish `0 2 * * *`, metrics `0 9 * * 1`
- `custom`: no auto-fill (admin edita manualmente)
IF el admin edita un cron tras aplicar template THE SYSTEM SHALL cambiar el select a `custom`.

### FR-114 — LinkedSelect project → step
THE SYSTEM SHALL render un LinkedSelect (FR-021 base) con A = proyecto (de content-pipeline) y B = runType (research/generate/publish/metrics).
[NEEDS CLARIFICATION — Q-005: si B no depende de A, degradar a 2 FormSelect independientes]

### FR-115 — Auto-fill desde project existente
WHEN se selecciona un proyecto en el form de create THE SYSTEM SHALL pre-cargar los cron defaults del config existente del proyecto si lo hay (modo "clonar").
IF el proyecto no tiene config previo THE SYSTEM SHALL cargar defaults del env (`AUTONOMOUS_AGENT_*_CRON`).

## FR — Endpoints backend

### FR-121 — GET /runs/stats
THE SYSTEM SHALL exponer `GET /v1/autonomous-agent/runs/stats` (admin) que retorne:
```
{
  totalRuns, runsToday, successRate,
  byRunType: { research: n, generate: n, publish: n, metrics: n },
  byStatus: { pending: n, running: n, completed: n, failed: n },
  costTokens: { prompt: n, completion: n, total: n },
  trend: [{ date: 'YYYY-MM-DD', completed: n, failed: n }],
  lastRun: { at, status } | null
}
```
WHEN `projectId` query param provided THE SYSTEM SHALL filtrar por proyecto.
THE SYSTEM SHALL aceptar `from`/`to` (ISO date) para acotar el rango (default 30 días).

### FR-122 — GET /configs/:id/stats
THE SYSTEM SHALL exponer `GET /v1/autonomous-agent/configs/:id/stats` (admin) que retorne:
```
{
  costTokens: { prompt, completion, total },
  runsCount, successRate, lastRun, nextRun
}
```
WHEN config pausado THE SYSTEM SHALL retornar `nextRun: null`.

## FR — RBAC

### FR-131 — Admin-only
THE SYSTEM SHALL exigir `RoleEnum.admin` en todos los endpoints de autonomous-agent (configs + runs + stats).
WHEN un no-admin accede THE SYSTEM SHALL retornar 403.
[ya implementado en controllers existentes — se mantiene]

## NFR — No funcionales

### NFR-101 — Performance dashboard
WHEN el dashboard carga THE SYSTEM SHALL resolver todos los KPIs en < 1500ms (incluye `GET /runs/stats` + `GET /configs`).
WHEN `trend.length > 1000` THE SYSTEM SHALL renderizar TrendChart en < 200ms.

### NFR-102 — i18n
THE SYSTEM SHALL sourcear todos los strings de `apps/front/i18n/locales/{es,en}/autonomous-agent.json` bajo namespace `autonomous-agent`.
THE SYSTEM SHALL traducir: labels de KPIs, runTypes, statuses, templates, modos de cron, empty-states, "próximas ejecuciones".

### NFR-103 — Accesibilidad
THE SYSTEM SHALL proveer ARIA roles en todos los StatCard, charts y CronScheduleEditor.
THE SYSTEM SHALL soportar Tab order en WeekdayPicker y CronScheduleEditor.
THE SYSTEM SHALL proveer `aria-label` en iconos de KPIs.

### NFR-104 — Seguridad
WHEN un agente ejecuta una acción `publish` THE SYSTEM SHALL respetar `autoApproveDrafts` del config (no publicar si false).
THE SYSTEM SHALL rate-limit manual triggers (no expuesto hoy — Q-006).
[NEEDS CLARIFICATION — Q-006: approval flow para acciones destructivas]

### NFR-105 — Responsive
THE SYSTEM SHALL apilar KPI cards verticalmente en mobile (≥ 320px) y horizontalmente en `md+`.
THE SYSTEM SHALL redimensionar charts via `autoresize` de vue-echarts.

### NFR-106 — Themeable
THE SYSTEM SHALL consumir `useThemeColors()` para todos los charts.
THE SYSTEM SHALL usar clases DaisyUI semantic (`bg-base-100`, `text-base-content`, `text-success`, `text-error`).