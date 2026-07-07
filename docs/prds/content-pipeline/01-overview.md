---
doc: content-pipeline/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

Content Pipeline genera contenido autónomo (research → ideas → drafts → publish → métricas) con jobs asíncronos de video/carousel via BullMQ. El frontend actual muestra KPIs ad-hoc con DaisyUI `.stat` y barras custom, y el backend expone un endpoint `/metrics/dashboard` cuyo contrato **no coincide** con lo que el frontend espera. Este PRD especifica dashboards operativos con info relevante (stages, throughput, latencia, queue status, success rate), forms automatizados (auto-suggest de steps, LinkedSelect source→destination, KeyValueEditor de config) y scheduling de pipelines recurrentes, consumiendo el catálogo base `@base/ui-app/components/{charts,scheduling,automation}/`.

## Problema

- **Dashboard ciego operativamente**: el frontend actual (`ContentPipelineDashboard.vue`, `pages/app/content-pipeline/index.vue`) muestra counts globales (totalProjects, totalIdeas, totalDrafts, totalPublished) pero NO expone info operativa: cuántos items hay en cola, throughput (items/hora), tiempo promedio por stage, latencia end-to-end, success rate, top fuentes. El operador no sabe si el pipeline está atascado.
- **Contrato roto**: el backend `MetricsService.dashboard()` retorna `DashboardSummary` (snapshots de métricas de performance post-publish: views, clicks, engagement, affiliateConversions, revenue, byPlatform). El frontend espera `DashboardData` (totalProjects, totalIdeas, totalDrafts, totalPublished, ideasByStatus, draftsByStatus, recentProjects). **Bug latente**: campos undefined renderizados como 0. `[NEEDS CLARIFICATION]` — ver Q-CP-001.
- **Forms manuales**: crear un project requiere tipear niche, keywords, brandVoice, targetAudience, socialConfig, cmsConfig, affiliateConfig sin ayuda. No hay auto-suggest de steps según tipo de contenido. No hay encadenamiento source→destination. Config de steps se ingresa en JSON crudo en jsonb.
- **Sin scheduling visual**: el pipeline real es gatillado por `autonomous-agent` (`@Cron` con cron strings crudos). Si se quiere schedular pipelines standalone (sin autonomous-agent), no hay editor visual de cron. El operador no entiende `0 9 * * 1`.
- **Duplicación**: KPIs ad-hoc (DaisyUI `.stat` con iconos lucide) duplican lo que `StatCard` del catálogo base estandariza. Barras custom de "Ideas by Status" duplican `BarChartCard`. `DonutChartCard` no existe en el dashboard actual.

## Objetivos medibles

1. **Dashboard operativo**: renderizar ≥6 KPIs vía `StatCard` (items en cola, activos, completados 24h, fallidos 24h, throughput items/hora, latencia p50 end-to-end).
2. **Charts base consumidos**: ≥4 componentes del catálogo base en el dashboard (`StatCard`, `TrendChart`, `BarChartCard`, `GaugeChartCard`, `DonutChartCard`).
3. **Contrato alineado**: backend expone `/content-pipeline/operational-dashboard` con payload tipado que el frontend consume sin `undefined` fallbacks.
4. **Forms automatizados**: crear project usa `LinkedSelect` (source→destination) y `KeyValueEditor` (config de steps). Auto-suggest de steps según `contentType` seleccionado.
5. **Scheduling visual**: página de schedules usa `CronScheduleEditor` + `WeekdayPicker` + `CronNextRunsPreview` para pipelines recurrentes.
6. **Cero duplicación**: dashboard actual ad-hoc refactorizado a componentes base (ver `06-migration-phases.md`).

## No-objetivos

- Implementar (eso es `sdd-apply`).
- Rediseñar el motor de generación (Tavily, Ollama, WaveSpeed, FFmpeg, Chromium) — fuera de scope.
- Construir el sistema de autonomous-agent (tiene su PRD).
- Migrar todo el frontend extension a Nuxt Layers v2 (se trata en `docs/DECOUPLING.md`).
- Dashboard de métricas de performance post-publish (views, clicks, revenue) — ya cubierto por `MetricsService.dashboard()`, NO es operacional.

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| Componentes base consumidos | ≥4 | Imports de `@base/ui-app/components/{charts,scheduling,automation}/` en `apps/front/extensions/content-pipeline/` |
| KPIs operativos en dashboard | ≥6 | `StatCard` instances en página dashboard |
| Endpoint operativo creado | 1 | `GET /content-pipeline/operational-dashboard` |
| Contrato front-back alineado | 0 undefined | Tipos compartidos, sin fallbacks `?? 0` por mismatch |
| Forms con LinkedSelect + KeyValueEditor | 2 | Página create-project, página pipeline-config |
| Página de schedules con cron editor | 1 | `pages/app/content-pipeline/schedules.vue` |
| Lint + type-check | passing | `pnpm lint` + `pnpm check-types` verdes |
| i18n keys | cubiertos | Namespace `content-pipeline` en `apps/front/i18n/locales/{es,en}/` |
| Dashboards ad-hoc eliminados | 0 | Sin `.stat` + lucide inline en dashboard page |