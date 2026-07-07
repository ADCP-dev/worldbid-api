---
doc: upload-post/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

Upload Post es la extensión de Foundation que automatiza la presencia social de
SOM-OS en 12 plataformas (Instagram, TikTok, YouTube, LinkedIn, Facebook, X,
Threads, Pinterest, Reddit, Bluesky, Discord, Telegram) vía la API Upload-Post.
Hoy la extensión existe: upload async, scheduling por fecha puntual, analytics con
snapshots diarios, AutoDMs, reporte semanal por cron y mensual. Lo que falta es
**visibilidad** (dashboards informativos con KPIs y trends), **automación de forms**
(auto-detección de tipo de archivo, auto-extracción de metadata, drag-drop multi-file,
destinos encadenados) y **scheduling entendible** (programar "cada lunes a las 9am"
sin saber cron syntax). Este PRD consume el catálogo `base-ui-components` para
construir esas tres capacidades sobre la base existente.

## Problema

- **Dashboards pobres**: las páginas `/app/upload-post`, `/analytics`, `/monthly`
  muestran datos crudos (tablas, listas, JSON de snapshots) sin KPIs, sin trends,
  sin distribución de status. El admin no ve de un vistazo "cuántos posts se
  subieron hoy, cuántos están programados, qué tasa de éxito tengo".
- **Forms manuales tediosos**: la página `upload.vue` exige tipear título, caption,
  elegir plataformas con toggles sueltos, pegar URLs de video/foto, y por plataforma
  completar fields extras (board de Pinterest, subreddit de Reddit, categoría de
  YouTube) sin encadenamiento. No hay auto-detección de tipo de archivo ni
  auto-extracción de metadata desde el archivo subido. No hay drag-drop multi-file.
- **Cron crudo no entendible**: `UPLOAD_POST_WEEKLY_REPORT_CRON = '0 9 * * 1'` se
  configura por env var. El admin no entiende esa cadena ni puede cambiarla desde
  UI. Tampoco hay vista de "próximas ejecuciones". La programación de posts
  puntuales usa `scheduledDate` ISO suelto — útil, pero no cubre publicación
  recurrente "cada lunes a las 9am" sin repetir el POST manual.
- **Scheduling de publicación recurrente ausente**: hoy solo se schedulea una fecha
  puntual por upload. No existe "publicar este contenido cada lunes y jueves a las
  9am durante N semanas". El `CronScheduleEditor` + `WeekdayPicker` +
  `CronNextRunsPreview` cubren la edición visual; el backend necesita soportar el
  patrón recurrente (open question Q-002).

## Objetivos medibles

1. **Dashboard de uploads**: página `/app/upload-post` muestra StatCards (uploads
   hoy / semana / mes, programados, publicados, tasa de éxito), TrendChart de
   uploads últimos 30 días, BarChartCard de uploads por día, DonutChartCard de
   distribución de status.
2. **Dashboard de analytics**: `/analytics` muestra StatCards por plataforma
   (followers, reach, views, engagement), TrendChart de reach/views últimos 30
   días, BarChartCard de reach por plataforma, DonutChartCard de share de
   impresiones por plataforma.
3. **Form de upload automatizado**: una sola página de upload con drag-drop
   multi-file, auto-detección de `mediaType` (video/photo/text) por MIME,
   auto-extracción de título desde el nombre de archivo, LinkedSelect
   plataforma→destino (board/subreddit/page), auto-suggest de schedule time desde
   el `queue/next-slot`.
4. **Scheduling visual**: `CronScheduleEditor` (modo weekly con `WeekdayPicker`)
   para configurar el cron del reporte semanal desde UI; `CronNextRunsPreview`
   muestra las próximas ejecuciones. `TimeWindowPicker` para definir ventanas
   horarias de publicación.
5. **Cero duplicación**: todos los charts/KPIs vienen de
   `@base/ui-app/components/{charts,scheduling,automation}/`. Ningún chart
   inline en `extensions/upload-post/`.

## No-objetivos

- Implementar el catálogo base (eso es el PRD `base-ui-components`).
- Reescribir la integración con la API Upload-Post (el `UploadPostClientService`
  ya cubre los endpoints necesarios).
- Migrar la extensión `analytics/` (tiene su propio PRD).
- Construir un sistema de dashboard layout drag-and-drop (grid composición fuera
  de scope).
- Auto-moderación de contenido por IA (Q-004, fuera salvo decisión contraria).
- Multi-perfil (hoy la extensión maneja UN solo `profileUsername`). Q-005.

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| StatCards en dashboards | ≥6 (3 uploads + 3 analytics) | Conteo en `index.vue` + `analytics.vue` |
| Charts consumidos | ≥3 tipos (Trend, Bar, Donut) | Imports en `extensions/upload-post/pages/` |
| Componentes base referenciados | ≥6/9 del catálogo | Matriz en `02-architecture.md` |
| Drag-drop multi-file | 1 página | `upload.vue` usa `FormMultipleFile` |
| Auto-detección mediaType | 100% uploads con archivo | `upload.vue` deriva tipo de MIME |
| LinkedSelect plataforma→destino | 3 plataformas con sub-destino | Pinterest board, Reddit subreddit, GBP location |
| Cron editable desde UI | 1 (reporte semanal) | Settings page usa `CronScheduleEditor` |
| CronNextRunsPreview | 1 vista | Settings page |
| Charts inline en extensión | 0 | Búsqueda `VChart`/`echarts` en `extensions/upload-post/` |
| Lint + type-check | passing | `pnpm lint` + `pnpm check-types` |
| i18n keys | cubiertos | `apps/front/i18n/locales/{es,en}/upload-post.json` |