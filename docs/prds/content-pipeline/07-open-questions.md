---
doc: content-pipeline/07-open-questions
title: "Preguntas Abiertas"
status: draft
created: 2026-07-07
---

# Preguntas Abiertas

## Q-CP-001 — Mismatch de contrato dashboard (bloqueante)
**Pregunta**: el frontend `DashboardData` espera `totalProjects, totalIdeas, totalDrafts, totalPublished, ideasByStatus, draftsByStatus, recentProjects`. El backend `DashboardSummary` retorna `totalSnapshots, byPlatform, totals{views,...}`. ¿Se alinea `dashboard()` existente o se crea `operationalDashboard()` nuevo?
**Recomendación**: crear `operationalDashboard()` nuevo (D-CP-01). Dejar `dashboard()` para performance post-publish. El frontend refactoriza al nuevo.
**Impacto**: bloqueante para Fase 0 y Fase 1. Sin decisión, el dashboard sigue mintiendo.
**Estado**: pendiente confirmación de producto.

## Q-CP-002 — Tipos de sources (no bloqueante)
**Pregunta**: el campo `idea.source` admite `manual | ai_research | trend | competitor_analysis`. El `LinkedSelect` source→destination (FR-CP-014) usa source = tipo de fuente de contenido (blog, instagram, tiktok, pinterest) que es `targetPlatforms`. ¿Source se refiere a `idea.source` o a `project.targetPlatforms`?
**Recomendación**: `LinkedSelect` source→destination se refiere a `targetPlatforms` (plataforma origen → plataforma destino de publicación). `idea.source` es otra dimensión (origen de la idea) y se muestra en `BarChartCard` top sources.
**Impacto**: no bloqueante. Se asume la recomendación.
**Estado**: se asume salvo objeción.

## Q-CP-003 — Circuit breaker para external APIs (no bloqueante)
**Pregunta**: si Tavily/Ollama/WaveSpeed caen, ¿se implementa circuit breaker (ej: `opossum`) o solo retry policy existente?
**Recomendación**: fuera de scope de este PRD. El retry policy existente (3 intentos, backoff 10s) es suficiente para v1. Circuit breaker se evalúa en un PRD de resiliencia separado.
**Impacto**: no bloqueante. Fallos en cascada (R-CP-02) se exponen via success rate gauge pero no se previenen.
**Estado**: fuera de scope. Documentado en R-CP-02.

## Q-CP-004 — Dead letter queue + drafts huérfanos (no bloqueante)
**Pregunta**: jobs `failed` tras 3 retries — ¿se mueven a una dead letter queue? ¿Qué pasa con drafts en status `generating` perpetuo?
**Recomendación**: fuera de scope. BullMQ retiene failed 7d. Para v1, el dashboard muestra "fallidos 24h" y el operador revisa manualmente. Dead letter queue y cleanup de drafts huérfanos se trata en PRD de resiliencia.
**Impacto**: no bloqueante. Datos perdidos tras 7d (R-CP-03).
**Estado**: fuera de scope. Documentado en R-CP-03.

## Q-CP-005 — Catálogo de step-templates: código vs DB vs JSON (⚠️ Ask first)
**Pregunta**: el catálogo estático de templates de steps mapeado por `contentType` — ¿dónde vive?
Opciones:
- (a) Código TypeScript en `composables/useStepTemplates.ts` (mapa `contentType → steps[]`).
- (b) Tabla `ext_cp_step_template` en DB.
- (c) JSON en `apps/front/i18n/locales/` o `assets/`.
**Recomendación**: (a) código. Los 6 contentTypes son estables, sin necesidad de edición runtime. Si crecen o requieren customización por tenant, se mueve a (b).
**Impacto**: no bloqueante. Se asume (a) salvo objeción.
**Estado**: se asume (a).

## Q-CP-006 — Scheduling dinámico en content-pipeline (⚠️ Ask first, bloqueante para Fase 3)
**Pregunta**: `@Cron` decorators se evalúan al bootstrap. Cambiar `scheduleCron` via UI NO cambia el schedule en vivo. ¿Cómo se ejecuta el cron dinámico?
Opciones:
- (a) `SchedulerService` con `@nestjs/schedule` dinámico (registra/cancela ScheduledTask en runtime).
- (b) Polling: un worker lee `scheduleCron` cada minuto y encola si toca.
- (c) Forzar uso de autonomous-agent (no scheduling standalone en content-pipeline).
**Recomendación**: (a) `@nestjs/schedule` dinámico. Es el patrón NestJS nativo. (c) descartado por acoplamiento.
**Impacto**: bloqueante para Fase 3. Sin decisión, la página schedules es solo cosmética (edita config pero no ejecuta).
**Estado**: pendiente decisión técnica.

## Q-CP-007 — Backpressure: ¿se pausa el encolar? (no bloqueante)
**Pregunta**: cuando la cola >50 o >100 jobs waiting, ¿se pausa el encolar automático o solo se alerta?
**Recomendación**: solo alerta visual (NFR-CP-006). Pausar el encolar puede perder jobs si el operador no ve la alerta. Backpressure real requiere circuit breaker en el producer.
**Impacto**: no bloqueante. Alerta visual es suficiente para v1.
**Estado**: se asume alerta-only.

## Q-CP-008 — Escalar workers de BullMQ (no bloqueante)
**Pregunta**: actualmente 1 `VideoJobProcessor` (1 worker). ¿Se escalar a N workers en paralelo?
**Recomendación**: fuera de scope. Escalar workers requiere considerar CPU (FFmpeg/Chromium son CPU-bound) y concurrencia de external APIs. Se trata en PRD de infraestructura.
**Impacto**: no bloqueante. Throughput limitado a 1 job a la vez.
**Estado**: fuera de scope.

## Q-CP-009 — Retención de metrics configurable (no bloqueante)
**Pregunta**: `RETENTION_DAYS = 90` hardcodeado en `MetricsService`. ¿Se hace configurable via env?
**Recomendación**: fuera de scope. 90d es razonable. Si se necesita histórico largo, se trata en PRD de analytics.
**Impacto**: no bloqueante.
**Estado**: fuera de scope.

## Q-CP-010 — NestJS Cache para operationalDashboard (⚠️ Ask first)
**Pregunta**: ¿Se habilita `@nestjs/cache-manager` para cachear `operationalDashboard()` 60s?
**Recomendación**: sí. Evita queries repetidas si el operador refresca. 60s TTL es razonable para data operacional.
**Impacto**: no bloqueante. Sin cache, queries repetidas pueden cargar DB.
**Estado**: pendiente aprobación de añadir `@nestjs/cache-manager` (dep nueva).

## Q-CP-011 — Componentes base faltantes (no bloqueante)
**Pregunta**: ¿hace falta algún componente base NO cubierto por el catálogo `docs/prds/base-ui-components/`?
**Análisis**: el catálogo cubre dashboards (charts), forms (LinkedSelect, KeyValueEditor), scheduling (cron editor). Content-pipeline NO requiere:
- Kanban (ya existe `@base/ui-app/components/kanban/`).
- DataTable (ya existe `@base/ui-app/components/data-table/`).
- RichEditor (ya existe).
- FormInput/Select/etc (ya existen).
**Conclusión**: no hacen falta componentes nuevos fuera del catálogo base. Todos los FR-CP se cubren con componentes existentes + los 11 del PRD base.
**Impacto**: no bloqueante.
**Estado**: cerrado — no requiere componentes nuevos.