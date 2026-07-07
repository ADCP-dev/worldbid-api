---
doc: autonomous-agent/01-overview
title: "Autonomous Agent — Overview"
status: draft
created: 2026-07-07
---

# Overview

## Resumen ejecutivo

La extensión Autonomous Agent orquesta el content-pipeline (research → generate → publish → metrics) vía BullMQ + `@Cron`, con un feedback loop semanal que ajusta prioridades de research. Hoy el dashboard muestra 4 KPIs en `stat` DaisyUI crudos, los forms exponen 4 inputs de texto para cron strings (`0 9 * * *`) sin feedback visual, y no hay trazabilidad de costo (tokens) ni vista de próximas ejecuciones. Este PRD mejora dashboards (con componentes base charts), automatiza forms (auto-suggest, LinkedSelect) y sustituye inputs cron por editores visuales con días de la semana y preview.

## Problema / motivación

1. **Dashboards poco informativos**: `pages/app/autonomous-agent/index.vue` muestra solo active configs, runs hoy, success rate y total — sin trends, sin costo, sin next run. `AutonomousAgentDashboard.vue` (widget inyectado) repite el mismo patrón. No hay distribución por tipo ni gauge de éxito.
2. **Forms manuales y crudos**: `configs/create.vue` y `configs/[id].vue` piden al admin 4 cron strings en `FormInput` texto plano. El admin tiene que saber cron de memoria. No hay auto-suggest según tipo de agente ni auto-fill desde template.
3. **Scheduling sin días de la semana visuales**: el backend soporta cron con dow (`0 9 * * 1` para lunes) pero el form no expone toggles L..D. No hay preview de próximas ejecuciones.
4. **Sin trazabilidad de costo**: el `job-processor.ts` ya captura `promptTokens` y `completionTokens` en `handleGenerate`, pero no se exponen ni agregan en el dashboard.

## Objetivos

- **O-1**: Dashboard con ≥8 KPIs relevantes usando StatCard, TrendChart, BarChartCard, DonutChartCard, GaugeChartCard.
- **O-2**: Form de config con CronScheduleEditor (4 phases) + WeekdayPicker + CronNextRunsPreview, eliminando inputs cron crudos.
- **O-3**: Form de config con auto-suggest de cron según tipo de agente y auto-fill desde template.
- **O-4**: LinkedSelect Project → pipeline step para vincular config a un paso concreto del content-pipeline.
- **O-5**: Exponer costo (tokens acumulados por config/proyecto) desde `ext_aa_run.output` agregado.
- **O-6**: Vista de "próximas ejecuciones" en config detail usando CronNextRunsPreview.

## No-objetivos

- **NO**: reescribir el backend (services, processor, scheduler) — solo se añaden endpoints de agregación y se ajustan DTOs si hace falta.
- **NO**: cambiar el sistema de colas BullMQ ni el `@Cron` interno del backend.
- **NO**: añadir Telegram notifications reales (el campo existe pero el sender no está implementado — fuera de scope).
- **NO**: approval flow humano para acciones destructivas (se plantea en Q-006, pero su implementación va en otro PRD si procede).
- **NO**: multi-tenant isolation (Q-007).
- **NO**: soporte para tipos de agente más allá de los 4 runTypes actuales (research/generate/publish/metrics) — Q-008.

## KPIs de éxito

| KPI | Meta | Medición |
|-----|------|----------|
| KPIs visibles en dashboard | ≥ 8 (hoy 4) | Conteo de StatCard/charts en `index.vue` |
| Tasa de error de validación de cron en form | < 5% (hoy alta, crudo) | Telemetría de submit fallido |
| Time-to-configure un agente | < 60s (hoy requiere saber cron) | Medición manual |
| Configs con costo visible | 100% | `ext_aa_run.output.promptTokens` agregado en UI |
| Cobertura de tests del frontend nuevo | ≥ 80% | Vitest coverage report |