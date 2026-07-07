---
doc: cms/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

El PRD CMS se considera completo cuando TODOS los siguientes gates pasan.

## Gates funcionales

### Dashboard
- [ ] `/app/cms` muestra 4 StatCard (publicados, borradores, programados, días desde última publicación).
- [ ] TrendChart de publicaciones 30d con toggle 7d/30d/90d.
- [ ] BarChartCard posts por categoría.
- [ ] DonutChartCard distribución por estado.
- [ ] BarChartCard top 5 autores.
- [ ] Lista top 5 posts recientes.
- [ ] Sección "Próximas publicaciones" con CronNextRunsPreview.
- [ ] Todos los textos en `cms.json` (es + en).
- [ ] Responsive mobile (grid-cols-1) y desktop.

### Forms automatizados
- [ ] Auto-author pre-relleno desde `useAuthStore()` en create post.
- [ ] Auto-slug reactivo (flag reactivo, no `const`).
- [ ] Auto-excerpt desde contenido (sobrescribible, no sobrescribe tras edición manual).
- [ ] LinkedSelect categoría→tags funcional.
- [ ] Mismos fixes aplicados a `[id]/edit.vue`.

### Scheduling
- [ ] `PostScheduleEditor.vue` integra CronScheduleEditor + WeekdayPicker + CronNextRunsPreview.
- [ ] `PATCH /cms/blog/posts/:id/schedule` valida cron y persiste.
- [ ] Cronjob procesa cola cada minuto.
- [ ] Post programado se publica en el siguiente tick (test e2e).
- [ ] Cancelar programación limpia estado + cola.
- [ ] Idempotencia: post ya publicado no se re-publica.
- [ ] Publicar ahora cancela programación pendiente.

### Backend
- [ ] `GET /cms/stats` retorna agregados.
- [ ] Migración `AddCmsSchedulingColumns` aplicada.
- [ ] Índices en `isPublished`, `publishedAt`, `scheduledPublishAt`, `categoryId`, `authorId`.
- [ ] `extension.manifest.ts` actualizado con nuevos endpoints.
- [ ] Bull queue `cms-scheduled-publish` registrada.
- [ ] `@Processor` publica, `@Cron` encola (multi-instancia safe).

### RBAC (si Fase 5)
- [ ] Roles `writer`, `editor`, `publisher`, `admin` sembrados.
- [ ] `@Roles` reemplazado por guards de permisos granulares.
- [ ] Writer no puede editar posts ajenos (test e2e).
- [ ] Publisher no puede borrar (test e2e).

## Gates técnicos

### Tests
- [ ] Unit tests del `ScheduledPublishProcessor` (casos: ok, retry, dead-letter, idempotencia).
- [ ] Unit tests de `GET /cms/stats` (agregaciones correctas).
- [ ] Unit tests de `PATCH /:id/schedule` (cron válido/inválido, cancelación).
- [ ] Integration test del flujo completo: crear → programar → tick cronjob → publicado.
- [ ] E2E (Playwright) del form automatizado: auto-author, auto-slug, auto-excerpt, LinkedSelect.
- [ ] E2E del dashboard: renderiza con datos reales.
- [ ] Cobertura > 80% en archivos nuevos del backend.

### Lint + Typecheck
- [ ] `pnpm lint` pasa (back + front).
- [ ] `pnpm check-types` pasa.
- [ ] `pnpm format` aplicado.
- [ ] Sin `any` en nuevas firmas (usar `unknown` + guards).
- [ ] Imports con alias absolutos (`@cms/*`, `@base/*`, `@ext/cms/*`).

### Documentación
- [ ] `docs/extensions/cms.md` actualizado con nueva sección "Scheduling" y "Dashboard mejorado".
- [ ] YAML frontmatter válido.
- [ ] `pnpm docs:sync` ejecutado exitosamente.
- [ ] `docs/ARCHITECTURE.md` regenerado (no editar a mano).
- [ ] Este PRD (`docs/prds/cms/`) actualizado a `status: approved` tras cierre de Qs bloqueantes.

### Persistencia memoria
- [ ] Decisiones guardadas en Engram (`mem_save`): arquitectura scheduling, elección LinkedSelect, auto-author.
- [ ] Bugs encontrados guardados (ej: `slugManuallyEdited` no reactivo).

## Git + PR

- [ ] Commits con conventional commits (`feat(cms):`, `fix(cms):`, `docs(cms):`).
- [ ] Sin "Co-Authored-By" ni atribución IA.
- [ ] Branch: `feature/cms-dashboard-forms-scheduling` (o similar).
- [ ] PR creada con `gh pr create` referenciando este PRD.
- [ ] Sin build ejecutado (regla del repo) salvo que el reviewer lo pida.
- [ ] Resumen de sesión guardado con `engram_mem_session_summary`.

## Criterios de no-aceptación (anti-DoD)

- ❌ Dashboard con datos mock hardcodeados.
- ❌ Form create sin auto-author/auto-slug corregido.
- ❌ Scheduling que pierde el job al reiniciar el backend.
- ❌ Cronjob que publica el mismo post múltiples veces.
- ❌ Sin invalidación de caché SWR (Q-07 sin resolver = Fase 4 bloqueada).
- ❌ Nuevos componentes custom duplicando `@base/ui-app` existentes.
- ❌ `console.log` en backend (usar NestJS Logger).
- ❌ Migración SQL escrita a mano (usar `pnpm migration:generate`).

## Resumen de gates por fase

| Fase | Gates críticos |
|------|----------------|
| 0 | Migración aplicada, app arranca |
| 1 | Tests processor, GET /stats < 500ms, manifest actualizado |
| 2 | Dashboard renderiza con datos reales, i18n es+en |
| 3 | Auto-* funcionando, LinkedSelect filtra, time-to-create < 60s |
| 4 | Post programado se publica < 2min, idempotencia, caché invalidada |
| 5 | RBAC granular, writer bloqueado de posts ajenos |