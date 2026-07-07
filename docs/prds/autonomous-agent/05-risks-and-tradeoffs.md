---
doc: autonomous-agent/05-risks-and-tradeoffs
title: "Autonomous Agent — Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos técnicos

### R-01 — Agregación de costo N+1
**Riesgo**: `GET /runs/stats` agrega `output.promptTokens + completionTokens` de miles de runs jsonb.
**Impacto**: query lenta (>2s) si el proyecto acumula muchos runs.
**Mitigación**: 
- Query SQL `SUM((output->>'promptTokens')::int)` en lugar de cargar entidades.
- Índice en `ext_aa_run(configId, status)` (ya existe `configId` index).
- Caché de 60s con `CacheService` si disponible.
- Default rango 30 días, máximo 90.

### R-02 — CronNextRunsPreview costoso en render
**Riesgo**: 4 instancias de CronNextRunsPreview computando 5 ejecuciones cada una en cada render.
**Impacto**: jank en form si el cron cambia frecuentemente.
**Mitigación**: `useDebounce` (200ms) sobre el cron antes de computar. `cron-parser` es síncrono y rápido (<1ms por compute).

### R-03 — Soft dependency frágil
**Riesgo**: si content-pipeline no está cargado, el dashboard muestra "sin datos" pero el backend sigue aceptando configs.
**Impacto**: confusión del admin (crea config, nada se ejecuta).
**Mitigación**: 
- Frontend: si `useContentPipeline().getProjects()` falla, mostrar banner "content-pipeline no disponible".
- Backend: `job-processor` ya loguea warning claro.
- Documentar en la doc de la extensión.

### R-04 — Templates hardcoded se desincronizan
**Riesgo**: los templates de auto-suggest (`daily`, `weekly`, `aggressive`) se hardcodean en frontend pero los defaults del backend pueden cambiar via env.
**Impacto**: el template `daily` del frontend no coincide con `AUTONOMOUS_AGENT_RESEARCH_CRON` customizado.
**Mitigación**: 
- Exponer los defaults del backend via `GET /autonomous-agent/defaults` (endpoint nuevo) y cargar los templates desde ahí.
- O aceptar la desincronización y documentar (Q-002).

### R-05 — Timezone mismatch
**Riesgo**: el backend `@Cron` corre en timezone del servidor, pero CronNextRunsPreview muestra en timezone del navegador.
**Impacto**: el admin ve "próxima ejecución 11:00" pero el servidor corre a las 09:00 UTC.
**Mitigación**: 
- Mostrar label de timezone en CronNextRunsPreview (ya lo hace FR-013 base).
- Documentar que el cron del backend es UTC por defecto (NestJS `@Cron` usa UTC salvo config).
- Q-009: ¿configurar timezone del scheduler?

## Riesgos de seguridad

### R-06 — Acciones destructivas sin approval
**Riesgo**: un agente `publish` con `autoApproveDrafts=true` publica automáticamente. Un misconfig puede publicar contenido no revisado.
**Impacto**: contenido indeseado en CMS / redes sociales.
**Mitigación**: 
- Mantener `autoApproveDrafts=false` por defecto (ya está).
- Añadir confirmación extra en el form al activar `autoApproveDrafts` (modal "¿estás seguro?").
- Log de auditoría en `ext_aa_run.output` (quién aprobó, cuándo).
- Q-006: approval flow explícito para `publish`.

### R-07 — Rate limit en triggers manuales
**Riesgo**: si se expone un endpoint `POST /runs/trigger` manual, un admin puede spamear y saturar BullMQ.
**Impacto**: cola saturada, costos LLM/Tavily descontrolados.
**Mitigación**: 
- Rate limit por configId (máx 1 trigger manual por minuto).
- Hoy no hay endpoint manual — solo el scheduler. Q-010: ¿exponer trigger manual?

### R-08 — Leak de tokens en logs
**Riesgo**: `job-processor.ts` loguea errores con el mensaje completo; si un error incluye el prompt o el output, los tokens se filtran a logs.
**Impacto**: información sensible en logs (no tokens API, sino contenido generado).
**Mitigación**: sanitizar `errorMessage` antes de loguear (truncar a 200 chars, sin stack de prompt).

## Riesgos de performance

### R-09 — Dashboard carga 3 endpoints en paralelo
**Riesgo**: `Promise.all([getConfigs, getRuns, getProjects])` + nuevo `getStats` = 4 calls paralelas.
**Impacto**: latencia total = max de las 4. Si `getStats` es lento, bloquea el render.
**Mitigación**: 
- Render progressive: KPIs básicos primero (configs + runs), stats después (skeleton).
- TanStack Query con `staleTime` 60s para evitar refetch en navegación.

### R-10 — Trend data crece indefinidamente
**Riesgo**: `trend[]` con 30 días x N configs puede ser grande si hay muchos proyectos.
**Impacto**: payload JSON > 100kb.
**Mitigación**: 
- Default 30 días, agrupado por día (no por run).
- `limit` máximo 90 días.
- Si el admin quiere más, descargar CSV (fuera de scope).

## Trade-offs

### T-01: Auto-suggest templates en frontend vs backend
**Decisión**: templates en frontend (mapa estático).
**Ganamos**: simplicidad, sin endpoint nuevo, sin latencia.
**Sacrificamos**: desincronización con env defaults (R-04).
**Por qué**: los defaults rara vez cambian y el admin puede editar tras aplicar template.

### T-02: CronScheduleEditor vs input crudo
**Decisión**: 4 CronScheduleEditor.
**Ganamos**: UX, validación visual, días de la semana, preview.
**Sacrificamos**: bundle size (+ `cronstrue` + `cron-parser` ~30kb), complejidad.
**Por qué**: el admin no sabe cron; el input crudo genera errores.

### T-03: Agregación SQL vs cargar entidades
**Decisión**: `SUM((output->>'promptTokens')::int)` en SQL.
**Ganamos**: performance, una sola query.
**Sacrificamos**: acoplamiento al shape de `output` jsonb (si cambia, query se rompe).
**Por qué**: el shape es estable (lo define `job-processor.ts`).

### T-04: LinkedSelect vs 2 FormSelect
**Decisión**: [PENDIENTE Q-005].
**Si LinkedSelect**: respetamos patrón base, pero B no depende realmente de A.
**Si 2 FormSelect**: más honesto con la realidad del dominio.
**Por qué**: depende de si en el futuro los runTypes varían por proyecto.