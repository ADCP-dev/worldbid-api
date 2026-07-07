---
doc: upload-post/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos

### R-01 — Archivos grandes y formatos variados
**Riesgo**: uploads de video pesados (>100MB) o formatos no soportados por
alguna plataforma (ej. `.mkv` no aceptado por Instagram) generan fallos
silenciosos o timeouts.
**Impacto**: alto.
**Mitigación**: hand-off async a la API Upload-Post (NFR-100), validación
MIME en el dropzone antes de subir, rechazo temprano con toast si la
plataforma seleccionada no soporta el tipo. Q-006 define el tamaño máximo.

### R-02 — Fallos en publicación programada
**Riesgo**: un post scheduleado para "lunes 9am" falla (API caída, credenciales
expiradas, plataforma rechaza contenido) y el admin no se entera hasta que
mira el dashboard.
**Impacto**: alto.
**Mitigación**: webhook `incoming` ya existe — debe marcar `status=error` +
`errorMessage`. Dashboard uploads (FR-103 Donut) muestra el segmento error.
NFR-105 exige log de toda transición. Q-007 define política de retry (¿Bull
queue con backoff? ¿notificación email al fallar?).

### R-03 — Storage y costos
**Riesgo**: almacenar muchos videos localmente o en S3 sin retención sube
costos. Hoy la extensión solo guarda `mediaUrl` (no bytes), pero si se
habilita un pipeline local de auto-extracción de metadata (ffmpeg) se
requiere storage temporal.
**Impacto**: medio.
**Mitigación**: NFR-104 — nunca bytes en DB, siempre Storage. Política de
retención de temporales (cleanup post-procesamiento). Q-006.

### R-04 — Cron UI ≠ cron vivo (R-04 del PRD base)
**Riesgo**: el `CronScheduleEditor` edita el cron persistido, pero
`@nestjs/schedule` evalúa decorators al bootstrap. Cambiar el cron via UI
NO aplica hasta reinicio del proceso.
**Impacto**: alto para el reporte semanal.
**Mitigación**: el `WeeklyReportService` lee el cron desde
`process.env.UPLOAD_POST_WEEKLY_REPORT_CRON` al bootstrap. Para que el
cambio vía UI aplique sin reinicio, el backend debe:
  (a) persistir el cron en DB, Y
  (b) re-registrar el job dinámicamente (`SchedulerRegistry.deleteJob` +
      `addCronJob`) — requiere `@nestjs/schedule` `ScheduleModule` con
      `dynamic cron`.
Alternativa simple: persistir + reiniciar proceso (documentado). Q-008
decide entre dinámico vs reinicio.

### R-05 — Schedule recurrente: expansión vs API nativa
**Riesgo**: si el backend expande `cron + untilDate` en N `scheduledDate`
puntuales, una edicion posterior del cron no actualiza los jobs ya creados
(snapshot rígido). Si la API Upload-Post soporta recurring nativo, delegar
es más limpio pero acopla a esa feature.
**Impacto**: medio.
**Mitigación**: Q-002 decide. Si backend expande, documentar que editar el
cron recurrente recrea los jobs (warn al admin). Si API nativa, mapear 1:1.

### R-06 — Auto-extracción de metadata frágil
**Riesgo**: extraer título desde filename produce títulos feos
(`promo-lunes-final-v2`). EXIF/primera frame de video requiere libs
pesadas (ffmpeg/exiftool) que no están en el stack.
**Impacto**: medio.
**Mitigación**: FR-121 solo pre-fill, el admin siempre puede editar. Para
extracción rica (primer frame, transcripción), Q-004 evalúa IA — gated.
Mantener MVP en filename + EXIF básico (imagen). Video: solo filename.

### R-07 — i18n de días de semana y tz
**Riesgo**: orden L..D (es) vs D..S (en), nombres localizados, tz del
usuario vs del servidor.
**Impacto**: bajo.
**Mitigación**: `WeekdayPicker` del catálogo ya es locale-aware (FR-011).
`CronNextRunsPreview` usa `Intl.DateTimeFormat` con tz configurable
(Q-003 del PRD base).

### R-08 — Accesibilidad del dropzone
**Riesgo**: drag-drop es difícil de operar por teclado y screen readers.
**Impacto**: medio.
**Mitigación**: NFR-103 — `role="button"`, `aria-label`, activación
Enter/Space que abre el file picker nativo. Alternativa: botón "Examinar"
siempre visible además del dropzone.

### R-09 — Webhook público sin rate limit
**Riesgo**: `POST /upload-post/webhooks/incoming` es público. Si el secreto
se filtra o no se valida la firma, un atacante puede inyectar status falsos.
**Impacto**: alto (seguridad).
**Mitigación**: `UPLOAD_POST_WEBHOOK_SECRET` ya existe en config. Validar
firma HMAC del header del webhook. Si no hay secreto configurado, rechazar
403. Q-009 confirma qué header firma la API.

### R-10 — Snapshot diario a las 23:00 puede faltar
**Riesgo**: si el proceso está caído a las 23:00, no hay snapshot del día.
El reporte semanal tiene un hueco.
**Impacto**: medio.
**Mitigación**: `WeeklyReportService.generate` ya tiene fallback a live API
(`generateFromLiveApi`). Dashboard analytics (FR-141) hace lo mismo con
warning log.

## Trade-offs

### T-01: Dashboards sobre snapshots vs live API
**Decisión**: dashboards analytics prefieren snapshots (ya hay cron diario);
fallback a live API si faltan.
**Se sacrifica**: datos en tiempo real (pueden tener 24h de retraso).
**Se gana**: performance (no golpea la API Upload-Post en cada render),
costo (la API puede tener rate limits), historial para trends.
**Por qué**: los trends de 30 días requieren snapshots — live API no da
historial. El fallback cubre el caso de snapshot faltante.

### T-02: Auto-detección MIME en frontend vs backend
**Decisión**: detección MIME en el frontend (drag-drop) usando
`File.type` del navegador; validación final en backend.
**Se sacrifica**: una fuente única de verdad (el navegador puede mentir
sobre MIME, aunque raro).
**Se gana**: feedback inmediato al admin, menos round-trips, UX mejor.
**Por qué**: el backend valida igual (defensa en profundidad), pero la UX
del dropzone exige clasificación instantánea.

### T-03: LinkedSelect plataforma→destino como wrapper vs orquestación manual
**Decisión**: usar `LinkedSelect` del catálogo (FR-021) envolviéndolo en
`PlatformDestinationSelect.vue` local que conoce los endpoints por plataforma.
**Se sacrifica**: el componente base es genérico; la lógica "qué endpoint
llamar por plataforma" vive en el wrapper local.
**Se gana**: reutilización del comportamiento UI (reset, autoFill), la
extensión solo aporta el map plataforma→endpoint.
**Por qué**: si el catálogo crece el `LinkedSelect`, upload-post hereda
mejoras sin tocar código.

### T-04: Cron del reporte semanal persistido en DB vs env var
**Decisión**: persistir en DB (`ext_uploadpost_settings`) con override del
env var (env wins si está set, DB es default mutable).
**Se sacrifica**: una fuente de configuración (env vs DB) — requiere
precedencia clara documentada.
**Se gana**: el admin puede cambiar el cron desde UI sin tocar el `.env`
ni reiniciar manualmente (con Q-008 resuelto).
**Por qué**: env vars requieren deploy; la UI es el punto de venta de la
extensión.

### T-05: Dashboard endpoints nuevos vs agregaciones en frontend
**Decisión**: endpoints nuevos `/dashboard/uploads` y `/dashboard/analytics`
que agregan en backend (SQL group by).
**Se sacrifica**: 2 endpoints nuevos + 1 service + 1 controller más.
**Se gana**: el frontend recibe datos listos para charts (sin procesar 100
rows en el browser), paginación/caching backend, respuestas pequeñas.
**Por qué**: si el frontend agrega, transfiere datos crudos pesados. Backend
agrega con SQL eficiente (índices en `status`, `createdAt` ya existen en
`UpPostEntity`).

### T-06: Schedule recurrente via expansión backend (MVP)
**Decisión (preliminar)**: MVP expande `cron + untilDate` en N
`scheduledDate` puntuales en el backend.
**Se sacrifica**: rígido — editar el cron no actualiza jobs ya creados.
**Se gana**: simplicidad, no depende de feature nativa de la API Upload-Post.
**Por qué**: hasta que Q-002 confirme soporte nativo, la expansión es
predecible y funciona con la API actual. Documentar la limitación en UI.