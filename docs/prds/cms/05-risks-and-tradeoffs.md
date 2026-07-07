---
doc: cms/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos técnicos

### R-01 — Inconsistencia caché SWR tras publicación programada
**Riesgo**: el blog usa SSG+SWR con TTL 1h. Un post publicado a las 09:00 por el cronjob no aparecerá hasta las 10:00.
**Impacto**: contenido programado invisible hasta 1h después.
**Mitigación**: tras publicar, invalidar caché (`useQueryClient().invalidateQueries(['cms','blog'])`) o llamar a `nuxt generate`/purge CDN. Ver Q-07.
**Severidad**: alta (rompe la promesa del scheduling).

### R-02 — Race condition publish ahora vs cronjob
**Riesgo**: admin publica a las 09:00:59 mientras el cronjob corre a las 09:01:00 y publica de nuevo.
**Mitigación**: NFR-105 idempotencia — el cronjob chequea `if (post.isPublished) skip`. FR-123 desencola al publicar manualmente.
**Severidad**: media.

### R-03 — Slug traducido vs slug base en scheduling
**Riesgo**: `findBySlugPublic` ya resuelve slug traducido vs base. Si un post programado tiene solo slug base (es) y un visitante entra por `/en/blog/:slug`, podría 404 hasta que se traduzca.
**Mitigación**: el scheduler no toca slugs; el admin debe crear traducción de slug antes de programar. Documentar en UX.
**Severidad**: baja.

### R-04 — Conflicto de edición concurrente
**Riesgo**: dos editores editan el mismo post a la vez; el último save gana y se pierden cambios.
**Impacto**: pérdida silenciosa de trabajo.
**Mitigación**: fuera de scope de este PRD (ver Q-08). Mitigación parcial: warn si `updatedAt` del formulario es más viejo que el del servidor al guardar.
**Severidad**: media.

### R-05 — Rendimiento dashboard con 10k+ posts
**Riesgo**: `publicationsByDay`, `byCategory`, `byAuthor` son GROUP BY sobre 10k filas. Sin índices puede tardar > 2s.
**Mitigación**: NFR-101 índices en `isPublished`, `publishedAt`, `categoryId`, `authorId`. Considerar materialized view si crece.
**Severidad**: media.

### R-06 — Cronjob en multi-instancia
**Riesgo**: si el backend corre en N instancias, el `@Cron` corre en todas → publicaciones duplicadas.
**Mitigación**: Bull con Redis distribuye los jobs (un worker los toma). El `@Cron` solo encola; los workers de Bull procesan. Usar `@Processor` no `@Cron` directo para publicar.
**Severidad**: alta si multi-instancia, baja si single.

## Riesgos de seguridad

### R-10 — Escalada de privilegios writer→editor
**Riesgo**: si `writer` puede editar `authorId` a su propio ID en un post ajeno, toma control.
**Mitigación**: FR-141 backend debe chequear `authorId == session.user.id` en update/delete para rol writer. No confiar en frontend.

### R-11 — Inyección de cron malicioso
**Riesgo**: expresión cron tipo `* * * * *` satura la cola con publicaciones cada minuto.
**Mitigación**: limitar a 1 job activo por post. Validar cron con `cron-parser` antes de persistir. Cap opcional: máx 100 posts programados simultáneos.
**Severidad**: baja.

## Trade-offs

### T-01: Bull queue vs setTimeout en proceso
**Decisión**: Bull (persistente, distribuido).
**Se gana**: survives restarts, multi-instancia, retries, observabilidad.
**Se pierde**: dependencia Redis (ya existe), más complejidad setup local.
**Por qué**: ya instalado, otros módulos lo usan, robustez > simplicidad.

### T-02: Guardar cronExpression vs solo scheduledPublishAt
**Decisión**: ambos.
**Se gana**: el usuario ve/edita el cron (recurrente); el sistema usa `scheduledPublishAt` para el siguiente tick sin recalcular.
**Se pierde**: 2 columnas extra, hay que mantenerlas sincronizadas al editar cron.
**Por qué**: UX (ver el cron) + performance (no recalcular cada minuto).

### T-03: Auto-author forzado vs sugerido
**Decisión**: sugerido (override manual permitido).
**Se gana**: flexibilidad (posts invitados, ghost writer).
**Se pierde**: pequeño riesgo de que el admin olvide confirmar.
**Por qué**: el override manual es común en CMS reales.

### T-04: LinkedSelect categoría→tags vs selects independientes
**Decisión**: LinkedSelect.
**Se gana**: menos opciones irrelevantes, mejor UX.
**Se pierde**: requiere definir el filtraje (Q-02). Si no hay relación directa tag↔categoría, el filtraje es por "tags usados en posts de esa categoría" (heurística).
**Por qué**: reduce carga cognitiva al editor.

### T-05: Cronjob cada minuto vs evento a la hora exacta
**Decisión**: cronjob cada minuto (simpler).
**Se gana**: implementación simple, maneja reintentos naturalmente.
**Se pierde**: latencia hasta 60s respecto al `scheduledPublishAt` exacto.
**Por qué**: 60s de margen es aceptable para publicación de contenido (no es trading).

## Mitigaciones prioritarias

1. **R-01** (caché SWR) — bloqueante para el valor del feature. Resolver antes de fase 3.
2. **R-06** (multi-instancia) — usar `@Processor` de Bull, no `@Cron` directo para publicar.
3. **R-10** (RBAC writer) — check backend obligatorio.