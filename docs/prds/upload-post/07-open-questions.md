---
doc: upload-post/07-open-questions
title: "Preguntas Abiertas"
status: draft
created: 2026-07-07
---

# Preguntas Abiertas

## Q-001 — ¿Mover procesamiento local a cola Bull?
**Pregunta**: hoy los uploads se delegan async a la API Upload-Post, pero
el `checkStatus` y el manejo de webhooks son síncronos. ¿conviene mover
post-procesamiento (auto-extracción de metadata, auto-tag, retry de fallos)
a una cola Bull propia de la extensión?
**Recomendación**: sí para auto-extracción pesada (IA en Q-004). Para retry
de fallos, una cola Bull con backoff exponencial (max 3 intentos) reduce
intervención manual. `@nestjs/bullmq` ya está instalado.
**Impacto si no se resuelve**: no bloqueante (MVP funciona sin cola). Pero
auto-tag con IA sin cola bloquea el request del admin — mala UX.
**Estado**: pendiente decisión con backend.

## Q-002 — Schedule recurrente: ¿expansión backend o API nativa?
**Pregunta**: FR-134 requiere publicación recurrente. ¿la API Upload-Post
soporta recurring nativo (pasar cron + until y que ella genere los jobs), o
el backend Foundation debe expandir `cron + untilDate` en N
`scheduledDate` puntuales y hacer N POSTs?
**Recomendación**: revisar `docs.upload-post.com` (Context7/Tavily). Si la
API soporta recurring nativo, delegar (T-06 se simplifica). Si no,
expansión backend con la limitación documentada (editar cron recrea jobs).
**Impacto si no se resuelve**: bloqueante para FR-134 y `schedule.vue`.
**Estado**: pendiente investigación de la API Upload-Post.

## Q-003 — ¿Añadir `cron-parser` al backend para validar cron en `/settings`?
**Pregunta**: `PUT /upload-post/settings` (FR-142) debe validar el cron
string antes de persistir. ¿añadir `cron-parser` como dep del backend
(ya propuesta para el frontend en el PRD base)?
**Recomendación**: sí. Misma lib que el frontend, consistencia.
**Impacto si no se resuelve**: no bloqueante (validación opcional — se
persiste el cron y si falla el `@Cron` lo loguea). Pero mala UX: el admin
guarda un cron inválido y no recibe feedback hasta el siguiente bootstrap.
**Estado**: pendiente aprobación de dep.

## Q-004 — Auto-detección de contenido por IA
**Pregunta**: FR-122 menciona auto-tag basado en "detected content
category". ¿se integra IA (visión/transcripción) para clasificar el
contenido del video/imagen y sugerir tags + caption?
**Recomendación**: gated. MVP = filename + EXIF básico. IA como fase 2 con
cola Bull (Q-001) para no bloquear el request. Evaluar proveedor (HeyGen?,
OpenAI Vision, local whisper para transcripción). Costo y latencia importan.
**Impacto si no se resuelve**: no bloqueante (FR-122 se limita a filename
tokens en MVP). IA es mejora futura.
**Estado**: fuera de scope MVP. Reabrir en fase 2.

## Q-005 — Multi-perfil
**Pregunta**: la extensión maneja un único `profileUsername` (SOM-OS).
¿se requiere soportar múltiples perfiles/clientes desde la misma extensión?
**Recomendación**: no. MVP = single-profile (alineado con el caso SOM-OS).
Multi-perfil cambia el modelo de datos (FK `profileUsername` en todas las
entidades) y la UI (selector de perfil en cada página). Fuera de scope.
**Impacto si no se resuelve**: no bloqueante. Confirmar con producto.
**Estado**: cerrado parcialmente — single-profile asumido. Reabrir si
producto pide multi-cliente.

## Q-006 — Tamaño máximo de archivo y retención
**Pregunta**: ¿cuál es el tamaño máximo por archivo (video/foto)? ¿política
de retención de archivos temporales de auto-extracción?
**Recomendación**: `UPLOAD_POST_MAX_FILE_SIZE_MB=500` default (videos),
`50` para fotos. Retención de temporales: 24h post-procesamiento, cleanup
vía cron diario existente (`dailySnapshot` no, agregar `cleanupTempFiles`).
**Impacto si no se resuelve**: no bloqueante (sin límite, elStorage module
falla con 413 propio del driver). Pero UX mejor con rechazo temprano.
**Estado**: pendiente confirmar límites con infra.

## Q-007 — Política de retry de publicación fallida
**Pregunta**: cuando un post scheduleado falla (R-02), ¿se reintenta
automáticamente? ¿cuántos intentos? ¿se notifica al admin por email?
**Recomendación**: 3 reintentos con backoff exponencial (1m, 5m, 15m) vía
Bull (Q-001). Tras 3 fallos, marcar `status=error` + notificar al
`UPLOAD_POST_WEEKLY_REPORT_EMAIL` (o `app.notificationEmail`).
**Impacto si no se resuelve**: no bloqueante para MVP (el admin ve el
error en el dashboard Donut). Pero mala operatividad.
**Estado**: pendiente decisión con producto.

## Q-008 — Cron dinámico vs reinicio
**Pregunta**: R-04. ¿el cron del reporte semanal editado vía UI aplica
dinámicamente (`SchedulerRegistry.deleteJob` + `addCronJob`) o requiere
reiniciar el proceso backend?
**Recomendación**: dinámico. `@nestjs/schedule` lo soporta via
`SchedulerRegistry`. Pequeño wrapper en `SettingsService` que al guardar
re-registra el job. Mejor UX, sin downtime.
**Impacto si no se resuelve**: bloqueante para el valor real de
`settings.vue` (si requiere reinicio, el admin prefiere editar `.env`).
**Estado**: pendiente prueba de viabilidad con `@nestjs/schedule` 6.1.

## Q-009 — Validación de firma del webhook
**Pregunta**: R-09. `POST /upload-post/webhooks/incoming` es público. ¿qué
header firma la API Upload-Post (HMAC)? ¿`X-Webhook-Signature`? ¿sha256
del body?
**Recomendación**: revisar `docs.upload-post.com` webhooks section.
Implementar `verifySignature(secret, body, header)` en `WebhooksService`.
Si no hay secreto configurado, rechazar 403.
**Impacto si no se resuelve**: bloqueante de seguridad (R-09). Sin
validación, cualquier puede inyectar status falsos.
**Estado**: pendiente investigación de la API Upload-Post.

## Q-010 — ¿GaugeChartCard en upload-post?
**Pregunta**: el catálogo incluye `GaugeChartCard` (FR-005) pero la matriz
de uso del PRD base no lo asigna a upload-post. ¿hay un gauge natural aquí?
**Recomendación**: sí — "storage usado vs cuota" (% del límite
`UPLOAD_POST_MAX_FILE_SIZE_MB` acumulado mensual) o "engagement rate vs
meta" (0-100%). Si se incluye, suma 1 consumer al catálogo (R-01 del PRD
base pide ≥2).
**Impacto si no se resuelve**: no bloqueante. Si no se usa, el gauge se
valida con stripe/content-pipeline.
**Estado**: opcional. Decidir en `sdd-design`.