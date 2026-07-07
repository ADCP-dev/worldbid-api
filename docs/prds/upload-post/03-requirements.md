---
doc: upload-post/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## FR — Dashboards informativos

### FR-100 — Dashboard de uploads (StatCard FR-001)
THE SYSTEM SHALL render a dashboard at `/app/upload-post` with StatCards for:
uploads today, uploads this week, uploads this month, scheduled posts count,
published posts count, success rate (%) = success / (success+error).
WHEN the admin opens `/app/upload-post` THE SYSTEM SHALL fetch
`GET /upload-post/dashboard/uploads` and render the StatCards.
IF no uploads exist in the period THE SYSTEM SHALL show `—` and an empty-state.

### FR-101 — TrendChart de uploads (FR-002)
THE SYSTEM SHALL render a TrendChart of uploads per day for the last 30 days.
WHEN mode is `area` THE SYSTEM SHALL fill under the line.
IF no data points exist THE SYSTEM SHALL show empty-state.

### FR-102 — BarChartCard uploads por día (FR-003)
THE SYSTEM SHALL render a BarChartCard with uploads per day (last 14 days,
vertical bars) titled "Uploads por día".

### FR-103 — DonutChartCard distribución de status (FR-004)
THE SYSTEM SHALL render a DonutChartCard from local posts grouped by
`status` (pending, processing, success, error, scheduled) with center value =
total posts.
WHEN a segment is hovered THE SYSTEM SHALL show tooltip with absolute value
and percentage.

### FR-110 — Dashboard de analytics (StatCard FR-001)
THE SYSTEM SHALL render StatCards per platform at `/app/upload-post/analytics`:
followers, reach, views, engagement rate = (likes+comments+shares+saves) / reach.
THE SYSTEM SHALL source data from `GET /upload-post/analytics/platform-metrics`
(live) or the latest daily snapshot when live fails.

### FR-111 — TrendChart analytics (FR-002)
THE SYSTEM SHALL render a TrendChart of reach and views for the last 30 days
per selected platform.
WHEN the admin selects a platform THE SYSTEM SHALL refetch the trend for it.

### FR-112 — BarChartCard reach por plataforma (FR-003)
THE SYSTEM SHALL render a BarChartCard (horizontal bars) of total reach per
platform for the last 7 days, sorted desc.

### FR-113 — DonutChartCard share de impresiones (FR-004)
THE SYSTEM SHALL render a DonutChartCard with share of total impressions per
platform for the last 7 days.

## FR — Forms automatizados

### FR-120 — Drag-drop multi-file
THE SYSTEM SHALL accept multiple files via drag-drop in the upload page using
`FormMultipleFile` from `@base/ui-app/components/form/`.
WHEN files are dropped THE SYSTEM SHALL detect each file's `mediaType` from its
MIME type (`video/*` → video, `image/*` → photo, `text/plain` → text) and route
to the corresponding upload flow.

### FR-121 — Auto-extracción de metadata
WHEN a video file is dropped THE SYSTEM SHALL auto-extract a title from the
filename (without extension) and pre-fill the title field.
IF the file exposes EXIF or container metadata (e.g. creation_date) THE SYSTEM
SHALL pre-fill `caption` and suggest a `scheduledDate` from it.
THE SYSTEM SHALL allow the admin to override every auto-extracted field.

### FR-122 — Auto-tag
WHEN a file is dropped THE SYSTEM SHALL auto-suggest tags based on filename
tokens and, if available, detected content category (Q-004 — IA detection
gated). Tags populate `UpPostEntity.tags`.

### FR-123 — LinkedSelect plataforma → destino (FR-021)
THE SYSTEM SHALL render a `LinkedSelect` where A = platform and B = sub-destination.
WHEN A is `pinterest` THE SYSTEM SHALL load B from
`GET /upload-post/platforms/pinterest/boards`.
WHEN A is `reddit` THE SYSTEM SHALL render B as a free-text subreddit input
(`redditSubreddit`).
WHEN A is `google-business` THE SYSTEM SHALL load B from
`GET /upload-post/platforms/google-business/locations`.
WHEN A changes THE SYSTEM SHALL reset B and, if `autoFill` and only one B
remains, auto-select it.
WHEN A is a platform without sub-destination (instagram, tiktok, youtube, x,
threads, bluesky) THE SYSTEM SHALL hide B.

### FR-124 — Auto-suggest schedule time
WHEN the admin enables "programar" THE SYSTEM SHALL call
`GET /upload-post/queue/next-slot` and pre-fill `scheduledDate` with the
returned slot.
THE SYSTEM SHALL allow the admin to override the suggested slot.

## FR — Scheduling con días de la semana

### FR-130 — CronScheduleEditor para reporte semanal (FR-010)
THE SYSTEM SHALL render a `CronScheduleEditor` in `/app/upload-post/settings`
bound to the weekly report cron string.
WHEN the admin saves THE SYSTEM SHALL `PUT /upload-post/settings` with the new
cron and the backend SHALL persist it (env override → DB-stored config).
THE SYSTEM SHALL default mode to `weekly` since the default cron is `0 9 * * 1`.

### FR-131 — WeekdayPicker (FR-011)
WHEN CronScheduleEditor mode is `weekly` THE SYSTEM SHALL render a
`WeekdayPicker` and produce `M H * * <days>`.

### FR-132 — TimeWindowPicker (FR-012)
THE SYSTEM SHALL render a `TimeWindowPicker` in `/app/upload-post/schedule` to
constrain publication windows (start, end) with timezone label.
WHEN `end <= start` THE SYSTEM SHALL mark invalid and emit `error`.

### FR-133 — CronNextRunsPreview (FR-013)
THE SYSTEM SHALL render a `CronNextRunsPreview` next to every
`CronScheduleEditor` showing the next 5 executions in the configured timezone.

### FR-134 — Schedule recurrente de publicación
THE SYSTEM SHALL allow the admin to schedule a recurring publication
("cada lunes y jueves a las 9am durante 4 semanas") from `/app/upload-post/schedule`.
WHEN the admin submits THE SYSTEM SHALL `POST /upload-post/schedule/recurring`
with `{ cron, content, untilDate, platforms }`.
THE backend SHALL expand the recurrence into N scheduled uploads via the
Upload-Post API (one `scheduledDate` per occurrence).
[NEEDS CLARIFICATION] — ver Q-002 (¿backend expansion vs API native recurring?).

## FR — Endpoints backend

### FR-140 — Dashboard uploads endpoint
THE SYSTEM SHALL expose `GET /upload-post/dashboard/uploads` returning:
`{ today, week, month, scheduled, published, successRate, uploadsPerDay: [{date, count}], statusDistribution: [{label, value}] }`.
WHEN no posts exist THE SYSTEM SHALL return zeroes and empty arrays (not 404).

### FR-141 — Dashboard analytics endpoint
THE SYSTEM SHALL expose `GET /upload-post/dashboard/analytics?days=30`
returning per-platform aggregated metrics for charts.
THE SYSTEM SHALL prefer stored snapshots; IF missing for the requested window
THE SYSTEM SHALL fall back to live API and log a warning.

### FR-142 — Settings endpoint
THE SYSTEM SHALL expose `GET /upload-post/settings` and `PUT /upload-post/settings`
for the weekly report cron and notification email.
WHEN `PUT` is called THE SYSTEM SHALL validate the cron string with `cron-parser`
before persisting.

### FR-143 — Schedule recurrente endpoint
THE SYSTEM SHALL expose `POST /upload-post/schedule/recurring` (FR-134).
THE SYSTEM SHALL reject `untilDate` earlier than now.

## FR — RBAC

### FR-150 — Admin-only en endpoints nuevos
THE SYSTEM SHALL guard `dashboard/*`, `settings`, `schedule/recurring` with
`@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(RoleEnum.admin)`.
THE SYSTEM SHALL keep `POST /upload-post/webhooks/incoming` public.

## NFR — No funcionales

### NFR-100 — Performance uploads async
WHEN a file > 50MB is uploaded THE SYSTEM SHALL process it asynchronously and
return `{ localId, requestId, jobId }` in < 2s (hand-off to API Upload-Post).
THE SYSTEM SHALL never block the request on the full upload completion.

### NFR-101 — Dashboard render
WHEN a dashboard fetches data THE SYSTEM SHALL render StatCards within 100ms of
data arrival; charts within 300ms (ECharts `autoresize`).
IF the API responds > 3s THE SYSTEM SHALL show skeleton loaders (StatCard
`loading` prop).

### NFR-102 — i18n
THE SYSTEM SHALL source all user-facing strings from
`apps/front/i18n/locales/{es,en}/upload-post.json` under namespace `upload-post`.
THE SYSTEM SHALL translate: dashboard labels, weekday names (via base-ui),
timezone labels, "próximas ejecuciones", empty-states, schedule prompts.

### NFR-103 — Accesibilidad
THE SYSTEM SHALL provide ARIA roles for drag-drop zone (`role="button"`,
`aria-label`), keyboard activation (Enter/Space to open file picker).
THE SYSTEM SHALL render chart data tables in `<table class="sr-only">` when
`a11yTable` prop is true.

### NFR-104 — Storage
WHEN files are uploaded THE SYSTEM SHALL rely on the Storage module
(`@storage/*`) for local/S3 persistence; never write file bytes into
`UpPostEntity` (only `mediaUrl`).
THE SYSTEM SHALL enforce a configurable max file size (Q-006) and reject
early with a 413-like error.

### NFR-105 — Logging
THE SYSTEM SHALL use NestJS `Logger` for all backend logs — never `console.*`.
THE SYSTEM SHALL log every status transition of `UpPostEntity` (pending →
processing → success/error) at `log` level.

### NFR-106 — Observabilidad de crons
WHEN a cron (`dailySnapshot`, `scheduledSendReport`) runs THE SYSTEM SHALL log
start, success/failure and duration. IF the weekly report fails to send THE
SYSTEM SHALL log at `error` level with the cause.

## Criterios de aceptación (ejemplos)

**Dashboard uploads vacío**:
- GIVEN no posts in DB
- WHEN admin opens `/app/upload-post`
- THEN StatCards show `—`, charts show empty-state, no 500.

**Auto-detect video**:
- GIVEN admin drops `promo-lunes.mp4`
- WHEN dropzone processes it
- THEN `mediaType=video`, title prefilled `promo-lunes`, platforms empty.

**LinkedSelect pinterest→board**:
- GIVEN A=pinterest, B options loaded from `/platforms/pinterest/boards`
- WHEN A changes to instagram
- THEN B hidden, `pinterestBoard` cleared.

**CronScheduleEditor weekly save**:
- GIVEN mode=weekly, days=[1,4], time=09:00
- WHEN admin saves
- THEN PUT `/upload-post/settings` with cron `0 9 * * 1,4`.
- THEN CronNextRunsPreview shows next 5 mondays/thursdays at 09:00.