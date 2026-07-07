---
doc: cms/01-overview
title: "Overview"
status: draft
created: 2026-07-07
---

# CMS Extension — Overview

## Resumen ejecutivo

La extensión CMS existe y funciona (CRUD de pages/posts/categories/tags/media, SEO, sitemap, multi-idioma vía translations). Pero el dashboard es un simple contador (4 KPIs planos), la creación de posts exige campos manuales que pueden auto-derivarse, y la publicación es binaria (ahora o no) sin opción de programar. Este PRD mejora tres frentes: (1) dashboard informativo con charts reales, (2) forms automatizados que reducen trabajo manual, (3) publicación programada vía cron.

## Problema

### Dashboard pobre
`apps/front/extensions/cms/components/CmsDashboard.vue` muestra 4 stat cards (Páginas, Posts, Categorías, Tags) con conteos planos. Sin tendencia, sin distribución por categoría/autor, sin views, sin freshness, sin programados. No permite al editor ver el estado del contenido de un vistazo.

### Creación de post manual
`pages/app/cms/blog/posts/create.vue` exige:
- **Autor como input de texto libre** — debería auto-fill desde `authStore.user` (nombre + apellido) con opción override.
- **Slug** — ya se auto-deriva del título (vía `kebabCase`), pero `slugManuallyEdited` es una variable no reactiva (`const slugManuallyEdited = false`) — bug: una vez seteada en focus nunca se resetea.
- **Excerpt** — no existe campo; debería auto-sugerirse desde los primeros N caracteres del contenido.
- **Categoría y tags** — selects independientes; podrían encadenarse (tags filtrados por categoría) vía `LinkedSelect` (FR-011).

### Scheduling opaco
`posts.service.ts:publish()` settea `publishedAt = new Date()` instantáneamente. No hay forma de programar publicación futura. `@nestjs/schedule` y `@nestjs/bullmq` están instalados en `apps/back/package.json` pero el CMS no los usa.

## Objetivos

1. **Dashboard informativo** — mostrar publicado/borrador/programado, views (si hay fuente), top content, publicaciones por día/mes, distribución por categoría y autor, usando `StatCard`/`BarChartCard`/`DonutChartCard`/`TrendChart`.
2. **Forms automatizados** — al crear post: auto-author desde sesión, auto-slug reactivo corregido, auto-excerpt desde contenido, `LinkedSelect` categoría→tags.
3. **Publicación programada** — editor cron en admin (`CronScheduleEditor` + `WeekdayPicker` + `CronNextRunsPreview`) que guarda una expresión cron por post; un cronjob backend procesa la cola y publica a la hora programada.

## No-objetivos

- Migrar a un headless CMS externo (Strapi, WordPress) — CMS first-class, ya decidido en `docs/extensions/cms.md`.
- Analytics de views propias — si no hay fuente de views, los FR de views quedan como `[NEEDS CLARIFICATION]` (Q-04).
- Versionado de posts con diff — fuera de scope (ver Q-03).
- Custom post types — fuera de scope (ver Q-05).
- Refactor del SEO system actual (funciona, no se toca).
- Resolver issue #81 (layout/category routing) — tiene su propio doc; este PRD lo referencia pero no lo implementa.

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| Tiempo de creación de un post | < 60s (hoy: ~3min por campos manuales) | Time-to-publish medido en test e2e |
| Posts programados vs publicados al instante | Habilitar uso de scheduling | Feature flag on/off |
| Latencia dashboard admin | < 500ms con 10k posts | Test de carga |
| Cobertura tests scheduling | > 80% líneas del cronjob | `nyc --reporter=text` |