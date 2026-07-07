---
doc: content-pipeline/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos

### R-CP-01 — Cuello de botella en cola de video
**Riesgo**: los jobs de video (FFmpeg + Chromium) toman 25-35s cada uno. Si se encolan >50, la cola satura y el throughput cae a 0 visible para el operador.
**Impacto**: alto.
**Mitigación**: `StatCard` de "items en cola" con warning visual >50 y alerta >100 (NFR-CP-006). Documentar que BullMQ no paraleliza por defecto (1 worker). `[NEEDS CLARIFICATION]` — ver Q-CP-008 sobre escalar workers.

### R-CP-02 — Fallos en cascada
**Riesgo**: si `Tavily` cae, no hay research. Si `Ollama Cloud` cae, no hay content gen. Si `WaveSpeed` cae, no hay images. Si `Chromium` cae, no hay carousel PNG. Un fallo en un stage bloquea todo el pipeline downstream.
**Impacto**: alto.
**Mitigación**: retry policy existente (3 intentos, backoff 10s). Pero NO hay circuit breaker. `GaugeChartCard` de success rate expone la tasa de fallo. `[NEEDS CLARIFICATION]` — ver Q-CP-003 sobre circuit breaker.

### R-CP-03 — Datos perdidos en jobs failed
**Riesgo**: jobs `failed` tras 3 retries se retienen 7d. Si el operador no revisa en 7d, el job y su `failedReason` se pierden. Drafts asociados quedan en status `generating` perpetuo.
**Impacto**: medio.
**Mitigación**: dashboard muestra "fallidos 24h" con `StatCard`. Recomendar revisión diaria. `[NEEDS CLARIFICATION]` — ver Q-CP-004 sobre dead letter queue y cleanup de drafts huérfanos.

### R-CP-04 — Contrato front-back roto (ya existe)
**Riesgo**: el frontend `DashboardData` espera `totalProjects`, `totalIdeas`, `totalDrafts`, `totalPublished`, `ideasByStatus`, `draftsByStatus`, `recentProjects`. El backend `DashboardSummary` retorna `totalSnapshots`, `byPlatform`, `totals{views,clicks,...}`. Hoy renderiza 0 por `?? 0` en todos los campos.
**Impacto**: alto (dashboard actual es mentira).
**Mitigación**: este PRD crea `operationalDashboard()` nuevo con contrato tipado compartido. El frontend refactoriza a ese endpoint. NO se intenta arreglar `dashboard()` existente.

### R-CP-05 — Scheduling dinámico no soportado por NestJS @Cron
**Riesgo**: `@Cron` decorators se evalúan al bootstrap. Cambiar `scheduleCron` via UI NO cambia el schedule del proceso en vivo. El operador configura un cron pero no se ejecuta hasta reinicio.
**Impacto**: alto (limita utilidad de la página schedules).
**Mitigación**: documentar que el editor edita la CONFIG persistida. Para ejecución dinámica, se requiere un `SchedulerService` que lea `scheduleCron` y encole jobs via `@nestjs/schedule` dinámico o un polling del worker. `[NEEDS CLARIFICATION]` — ver Q-CP-006.

### R-CP-06 — Auto-suggest de steps rígido
**Riesgo**: el catálogo estático de templates de steps puede no cubrir casos custom. Operadores avanzados quieren steps arbitrarios.
**Impacto**: medio.
**Mitigación**: `KeyValueEditor` permite config arbitraria por step. El catálogo es un punto de partida, no una camisa de fuerza. El usuario puede rechazar el auto-suggest y definir steps manuales.

### R-CP-07 — Backpressure no manejado
**Riesgo**: BullMQ no tiene backpressure nativo. Si el producer encola más rápido de lo que el worker consume, la cola crece indefinidamente.
**Impacto**: medio.
**Mitigación**: warning visual en dashboard >50 jobs. `[NEEDS CLARIFICATION]` — ver Q-CP-007 sobre si se pausa el encolar cuando la cola satura.

### R-CP-08 — Metrics cleanup agresivo
**Riesgo**: `MetricsService.cleanupOldMetrics()` borra snapshots >90d. Si el operador quiere trends de 6 meses, no hay data.
**Impacto**: bajo.
**Mitigación**: `TrendChart` de throughput se limita a 24h (no usa snapshots de metrics, usa BullMQ job timestamps). `[NEEDS CLARIFICATION]` — ver Q-CP-009 sobre retención configurable.

## Trade-offs

### T-CP-01: Endpoint operativo separado vs unificado
**Decisión**: crear `GET /operational-dashboard` nuevo. NO tocar `/metrics/dashboard`.
**Se sacrifica**: un único endpoint "todo en uno".
**Se gana**: separación clara performance (post-publish) vs operacional (queue, throughput). Contrato tipado sin mezclas.
**Por qué**: dominios distintos, consumers distintos, evolucionan distinto.

### T-CP-02: Catálogo estático de step-templates vs IA vs DB
**Decisión**: catálogo estático en código (`contentType → steps[]`).
**Se sacrifica**: flexibilidad (no se agrega template sin deploy).
**Se gana**: determinismo, sin coste de IA, sin query DB, predecible.
**Por qué**: los 6 contentTypes actuales (recipe, comparison, tips, review, listicle, guide) son estables. Si crecen, se mueve a DB. `[NEEDS CLARIFICATION]` ver Q-CP-005.

### T-CP-03: Refactor dashboard ad-hoc vs mantener + añadir
**Decisión**: refactor completo del dashboard actual a componentes base (ver `06-migration-phases.md`).
**Se sacrifica**: trabajo de migración (deuda existente).
**Se gana**: cero duplicación, consistencia con las 8 extensiones, accesibilidad heredada de los componentes base.
**Por qué**: el dashboard actual es mentira (R-CP-04). Mejor reconstruir sobre base sólida.

### T-CP-04: Schedule en content-pipeline vs solo autonomous-agent
**Decisión**: añadir scheduling standalone en content-pipeline.
**Se sacrifica**: dos lugares donde configurar schedules (puede confundir).
**Se gana**: pipelines simples sin orquestador completo. autonomous-agent sigue para loops con feedback.
**Por qué**: no todos los pipelines necesitan feedback loop. Forzar autonomous-agent es acoplamiento innecesario. `[NEEDS CLARIFICATION]` ver Q-CP-006.

### T-CP-05: Queue stats via BullMQ counts vs tabla de job events
**Decisión**: usar BullMQ `getWaitingCount()` etc (counts O(1)).
**Se sacrifica**: no hay histórico de queue stats (solo estado actual).
**Se gana**: latencia <100ms, sin tabla nueva, sin migración.
**Por qué**: para histórico de throughput se usan timestamps de jobs completed (ya persistidos por BullMQ). Queue stats es solo el "ahora".