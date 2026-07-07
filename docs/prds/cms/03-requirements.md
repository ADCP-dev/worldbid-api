---
doc: cms/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## FR — Dashboard informativo

### FR-101 — Dashboard con StatCards
THE SYSTEM SHALL render un dashboard en `/app/cms` con al menos 4 `StatCard` (FR-001 base): posts publicados, posts en borrador, posts programados (con `scheduledPublishAt` futuro), y total de posts.
WHEN un contador es cero THE SYSTEM SHALL mostrar `0` sin skeleton tras carga.
IF el permiso del usuario no incluye `cms:posts:read` THE SYSTEM SHALL ocultar las cards de posts y mostrar solo las de pages si tiene permiso.

### FR-102 — TrendChart de publicaciones
THE SYSTEM SHALL mostrar un `TrendChart` (FR-002 base) con publicaciones por día de los últimos 30 días.
WHEN el rango de fechas sea 0 (sin publicaciones) THE SYSTEM SHALL mostrar empty-state.
THE SYSTEM SHALL aceptar un toggle `range: '7d' | '30d' | '90d'` (default `30d`).

### FR-103 — BarChartCard posts por categoría
THE SYSTEM SHALL mostrar un `BarChartCard` (FR-003 base) con número de posts por categoría.
WHEN una categoría no tiene posts THE SYSTEM SHALL mostrarla con valor 0 si el usuario activó "mostrar vacías".

### FR-104 — DonutChartCard distribución por estado
THE SYSTEM SHALL mostrar un `DonutChartCard` (FR-004 base) con distribución de posts por estado: publicado, borrador, programado.
THE SYSTEM SHALL mostrar en el center label el total de posts.

### FR-105 — BarChartCard posts por autor
THE SYSTEM SHALL mostrar un `BarChartCard` horizontal con top 5 autores por número de posts publicados.
[NEEDS CLARIFICATION] Q-01: ¿incluir autores huésped/invitados? Por ahora solo `UserEntity`.

### FR-106 — Top content (lista)
THE SYSTEM SHALL mostrar una lista "Top 5 posts recientes" con slug, autor, fecha, badge de estado, link a edit.
WHEN no hay posts THE SYSTEM SHALL mostrar empty-state con CTA "Crear primer post".

### FR-107 — Content freshness
THE SYSTEM SHALL mostrar una `StatCard` con "días desde última publicación" calculado como `now - max(publishedAt)`.
WHEN no hay publicados THE SYSTEM SHALL mostrar `—`.

## FR — Forms automatizados

### FR-110 — Auto-author desde sesión
WHEN el usuario abre `/app/cms/blog/posts/create` THE SYSTEM SHALL pre-rellenar el campo `author` con `${authStore.user.firstName} ${authStore.user.lastName}`.
THE USER SHALL poder sobrescribir el valor manualmente.
WHEN el usuario guarda sin tocar el campo THE SYSTEM SHALL persistir el valor pre-rellenado.

### FR-111 — Auto-slug reactivo corregido
WHEN el usuario escribe en `title` THE SYSTEM SHALL actualizar `slug` con `/${kebabCase(title)}`.
IF el usuario edita manualmente `slug` THE SYSTEM SHALL dejar de auto-derivar (flag reactivo, no `const` como en código actual).
WHEN el usuario limpia `slug` THE SYSTEM SHALL reanudar auto-derivación desde `title`.

### FR-112 — Auto-excerpt desde contenido
WHEN el usuario escribe en `content` THE SYSTEM SHALL sugerir un excerpt con los primeros 160 caracteres del texto plano (sin HTML).
THE USER SHALL poder sobrescribir el excerpt sugerido.
IF el excerpt sugerido ya fue editado manualmente THE SYSTEM SHALL no sobrescribirlo.

### FR-113 — LinkedSelect categoría → tags
THE SYSTEM SHALL usar `LinkedSelect` (FR-011 base) para encadenar categoría (A) y tags (B).
WHEN se selecciona categoría A THE SYSTEM SHALL filtrar los tags disponibles a los asignados a posts de esa categoría (o todos si no hay filtraje disponible).
IF solo queda un tag THE SYSTEM SHALL auto-seleccionarlo con `autoFill=true`.
[NEEDS CLARIFICATION] Q-02: ¿el filtraje A→B es por categoría de los posts asociados al tag, o por una relación directa tag↔categoría?

### FR-114 — Auto-set publish date al programar
WHEN el usuario configura un cron en `PostScheduleEditor` THE SYSTEM SHALL pre-calcular `scheduledPublishAt` (próxima ejecución) y mostrarlo junto al `CronNextRunsPreview`.

## FR — Scheduling de publicación

### FR-120 — Editor cron en admin
THE SYSTEM SHALL exponer un componente `PostScheduleEditor.vue` que envuelve `CronScheduleEditor` (FR-006 base) + `WeekdayPicker` (FR-007) + `CronNextRunsPreview` (FR-009).
THE USER SHALL poder elegir modo `minutes|daily|weekly|monthly|advanced`.
WHEN el cron es inválido THE SYSTEM SHALL mostrar error y deshabilitar el botón "Programar".

### FR-121 — Endpoint schedule
WHEN el admin llama `PATCH /cms/blog/posts/:id/schedule` con `{ cronExpression: string }` THE SYSTEM SHALL validar formato cron, persistirlo en `blogPost.cronExpression`, recalcular `scheduledPublishAt` y encolar en Bull.
IF el cron es inválido THE SYSTEM SHALL responder `400 Bad Request` con mensaje.
WHEN el admin llama `PATCH /cms/blog/posts/:id/schedule` con `{ cronExpression: null }` THE SYSTEM SHALL cancelar la programación (desencolar).

### FR-122 — Cronjob procesa cola
WHILE el cronjob `@Cron('* * * * *')` corre THE SYSTEM SHALL desencolar posts con `scheduledPublishAt <= now`, setear `isPublished=true`, `publishedAt=now`, y emitir evento `post.published`.
WHEN un job falla THE SYSTEM SHALL reintentar 3 veces con backoff exponencial, luego mover a dead-letter queue con log de error.
THE SYSTEM SHALL usar el NestJS `Logger` (no `console.log`) para logs de éxito/fallo.

### FR-123 — Cancelar programación al publicar ahora
WHEN el admin publica un post inmediatamente (PATCH `/publish` con `isPublished=true`) THE SYSTEM SHALL cancelar cualquier programación pendiente (limpiar `cronExpression` y `scheduledPublishAt`, desencolar).

### FR-124 — Listado de programados
THE SYSTEM SHALL mostrar en el dashboard una sección "Próximas publicaciones" usando `CronNextRunsPreview` con los 5 posts más próximos por `scheduledPublishAt`.

## FR — Endpoints backend

### FR-130 — Stats endpoint
THE SYSTEM SHALL exponer `GET /cms/stats` que retorna: `totalPublished`, `totalDrafts`, `totalScheduled`, `publicationsByDay[30]`, `byCategory[]`, `byAuthor[]`, `byState[]`, `daysSinceLastPublish`.
IF el caller no es admin THE SYSTEM SHALL responder `403`.

### FR-131 — Schedule endpoint (ver FR-121)
THE SYSTEM SHALL exponer `PATCH /cms/blog/posts/:id/schedule`.

## FR — RBAC

### FR-140 — Roles CMS
THE SYSTEM SHALL soportar roles: `writer` (crea/edita propios posts), `editor` (edita cualquier post, programa), `publisher` (publica/despublica), `admin` (todo + manage categories/tags/media/seo).
[NEEDS CLARIFICATION] Q-06: el manifest actual solo declara `admin` en `@Roles`. ¿Migrar a permisos granulares (`cms:posts:publish` etc.) que ya existen en el manifest?

### FR-141 — Writer solo edita propios posts
IF el rol es `writer` THE SYSTEM SHALL impedir que edite posts donde `authorId != session.user.id`.
THE SYSTEM SHALL permitir a `writer` ver todos los posts pero solo editar/borrar los propios.

## NFR

### NFR-101 — Performance dashboard
WHEN el dashboard carga con 10k posts THE SYSTEM SHALL responder en < 500ms.
THE SYSTEM SHALL usar índices en `isPublished`, `publishedAt`, `scheduledPublishAt`, `categoryId`, `authorId`.

### NFR-102 — i18n multi-idioma CMS
THE SYSTEM SHALL mostrar todas las strings del admin desde `apps/front/i18n/locales/{es,en}/cms.json`.
THE SYSTEM SHALL respetar el locale activo en `WeekdayPicker` y `CronNextRunsPreview`.

### NFR-103 — Accesibilidad
THE SYSTEM SHALL soportar navegación por teclado en `PostScheduleEditor` (Tab order, Enter en toggles de WeekdayPicker).
THE SYSTEM SHALL proveer `aria-label` en iconos de acción (programar, cancelar programación).

### NFR-104 — SEO no se rompe
THE SYSTEM SHALL mantener el SSR de `/[lang]/page/:slug` y el SSG+SWR de `/[lang]/blog/:slug`.
WHEN un post programado se publica automáticamente THE SYSTEM SHALL invalidar la caché SWR del blog para que el post aparezca sin esperar 1h. [NEEDS CLARIFICATION] Q-07.

### NFR-105 — Idempotencia del cronjob
WHEN el cronjob corre pero el post ya fue publicado manualmente THE SYSTEM SHALL no duplicar publicación ni sobrescribir `publishedAt`.

## Criterios de aceptación (Given/When/Then)

**Auto-slug reactivo**:
- GIVEN create post con `title="Mi Post"`
- WHEN el usuario escribe
- THEN `slug` se actualiza a `/mi-post` reactivamente.

**Auto-author**:
- GIVEN usuario logueado `firstName=Ada lastName=Lovelace`
- WHEN abre create post
- THEN `author` muestra "Ada Lovelace" pre-rellenado.

**Programar publicación**:
- GIVEN post draft con `cronExpression="0 9 * * 1"` (lunes 09:00)
- WHEN el cronjob corre a las 09:01 del lunes
- THEN `isPublished=true`, `publishedAt=09:01`, y el post aparece en `/blog/:slug`.

**Cancelación al publicar ahora**:
- GIVEN post con `cronExpression` set y `scheduledPublishAt` futuro
- WHEN admin llama `/publish` con `isPublished=true`
- THEN `cronExpression=null`, `scheduledPublishAt=null`, y el job sale de la cola.