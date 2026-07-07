---
doc: cms/06-migration-phases
title: "Fases de Migración"
status: draft
created: 2026-07-07
---

# Fases de Migración

Este PRD es **refactor parcial + feature nueva**. El CMS existe; se moderniza el dashboard, se automatizan forms existentes y se añade scheduling. Fases incrementales, cada una desplegable de forma independiente.

## Principios

- Cada fase deja el sistema funcional (no romper producción).
- Las fases se pueden desplegar por separado.
- Rollback por fase: revertir migración + código + frontend.

---

## Fase 0 — Pre-requisitos (backend)

**Objetivo**: añadir columnas de scheduling y registrar Bull/Schedule.

**Entregables**:
- Migración `AddCmsSchedulingColumns`: añade `cronExpression: varchar(120) null`, `scheduledPublishAt: timestamp null` a `ext_cms_blog_post`.
- Verificar `ScheduleModule.forRoot()` registrado en `infrastructure.module.ts` (Q-09).
- Verificar `BullModule.forRootAsync` registrado (debería existir por upload-post).

**Criterios de salida**:
- `pnpm migration:run` exitoso.
- App arranca sin errores.

**Rollback**: `pnpm migration:revert`.

**Riesgos**: ninguno (columnas nullable, no afectan código existente).

---

## Fase 1 — Backend stats + schedule endpoints

**Objetivo**: exponer datos para dashboard y endpoints de scheduling.

**Entregables**:
- `GET /cms/stats` (FR-130) con query optimizada + índices (NFR-101).
- `PATCH /cms/blog/posts/:id/schedule` (FR-121) valida cron con `cron-parser`.
- `BullModule.registerQueue({ name: 'cms-scheduled-publish' })` en `PagesModule`/`BlogModule`.
- `ScheduledPublishProcessor` (`@Processor`) que desencola y publica (FR-122).
- `@Cron('* * * * *')` job que encola posts con `scheduledPublishAt <= now` (solo 1 job por tick, deduplica).
- Idempotencia check (NFR-105): skip si ya `isPublished`.
- Tests unit + integration del processor (mock Bull, mock repo).
- Update `extension.manifest.ts` `contributes.routes` con nuevos endpoints.

**Criterios de salida**:
- Tests del processor pasan (casos: publish ok, retry, dead-letter, idempotencia).
- `GET /cms/stats` responde < 500ms con 10k posts (test de carga básico).
- Lint + typecheck pasan.

**Rollback**: revertir endpoints + queue; las columnas quedan (no rompen nada).

---

## Fase 2 — Dashboard frontend con componentes base

**Objetivo**: reemplazar `CmsDashboard.vue` por dashboard informativo.

**Depende de**: PRD `base-ui-components` entregado (StatCard, TrendChart, BarChartCard, DonutChartCard disponibles en `@base/ui-app/components/charts/`).

**Entregables**:
- Composable `useCmsStats.ts` que llama `GET /cms/stats`.
- Reescribir `CmsDashboard.vue`:
  - 4 StatCard (FR-101): publicados, borradores, programados, días desde última publicación (FR-107). Views diferido a Q-04.
  - TrendChart publicaciones 30d (FR-102) con toggle 7d/30d/90d.
  - BarChartCard por categoría (FR-103).
  - DonutChartCard por estado (FR-104).
  - BarChartCard horizontal top 5 autores (FR-105).
  - Lista top 5 recientes (FR-106).
  - Sección "Próximas publicaciones" con CronNextRunsPreview de los 5 más próximos (FR-124).
- i18n strings en `apps/front/i18n/locales/{es,en}/cms.json` (NFR-102).
- Tests visuales / snapshot del dashboard.

**Criterios de salida**:
- Dashboard renderiza con datos reales (sin mocks).
- Responsive mobile (grid-cols-1) y desktop.
- Lint + typecheck.

**Rollback**: volver a `CmsDashboard.vue` anterior (git revert).

---

## Fase 3 — Forms automatizados

**Objetivo**: reducir fricción en create/edit de posts.

**Depende de**: PRD `base-ui-components` (LinkedSelect).

**Entregables**:
- Fix `slugManuallyEdited` reactivo en `create.vue` y `[id]/edit.vue` (FR-111) — reemplazar `const` por `ref(false)`.
- Auto-author desde `useAuthStore()` (FR-110) en `create.vue`.
- Auto-excerpt desde contenido (FR-112): nuevo campo `excerpt` en form, watch `content`, extraer texto plano de HTML (con `DOMParser` o regex simple).
- LinkedSelect categoría→tags (FR-113) reemplazando los 2 selects independientes.
- Aplicar mismos cambios a `[id]/edit.vue`.
- Tests e2e: crear post con todos los autos activos, verificar persistencia.

**Criterios de salida**:
- Time-to-create < 60s en test e2e.
- Auto-excerpt sobreescribible y no sobrescribe tras edición manual.
- LinkedSelect filtra tags correctamente.

**Rollback**: revertir las páginas .vue.

---

## Fase 4 — Scheduling UI frontend

**Objetivo**: permitir al admin programar publicación.

**Depende de**: Fase 1 (endpoints backend) + PRD base-ui (CronScheduleEditor, WeekdayPicker, CronNextRunsPreview).

**Entregables**:
- `PostScheduleEditor.vue` wrap de CronScheduleEditor + CronNextRunsPreview (FR-120).
- Integrar en `create.vue` y `[id]/edit.vue` como sección "Programar publicación".
- Composable `schedulePost(id, cron)` en `useCmsBlogPosts.ts` (FR-121).
- Botón "Publicar ahora" llama `/publish` y cancela programación (FR-123).
- Mostrar badge "Programado" en listado de posts (FR-124 ya en dashboard; aquí en tabla).
- Invalidación caché SWR tras publicación (R-01, Q-07) — implementar estrategia decidida en la Q.
- Tests e2e: programar post, simular tick del cronjob (mock o esperar 60s), verificar publicación.

**Criterios de salida**:
- Post programado se publica en el siguiente tick del cronjob.
- Cancelar programación limpia estado y cola.
- Cron inválido muestra error y bloquea guardar.

**Rollback**: ocultar `PostScheduleEditor` por feature flag.

---

## Fase 5 — RBAC granular (opcional, depende Q-06)

**Objetivo**: roles `writer`, `editor`, `publisher`, `admin`.

**Depende de**: Q-06 resuelta.

**Entregables**:
- Seeds de nuevos roles con `homeRoute: '/app/cms'`.
- Migrar `@Roles(RoleEnum.admin)` → `@Permissions('cms:posts:publish')` (o equivalentes) en controllers CMS.
- Guards de permisos granulares (si no existen en IAM core).
- Frontend: ocultar acciones según permiso del usuario.
- FR-141 backend check `authorId == session.user.id` para writer.

**Criterios de salida**:
- Writer no puede editar posts ajenos (test e2e).
- Publisher puede publicar/despublicar pero no borrar.
- Admin puede todo.

**Rollback**: revertir seeds + decorators.

---

## Resumen de fases

| Fase | Bloquea a | Es bloqueada por | Tiempo estimado |
|------|-----------|------------------|----------------|
| 0 | 1, 4 | — | 0.5 día |
| 1 | 2, 4 | 0 | 2 días |
| 2 | — | 1 + base-ui | 1.5 días |
| 3 | — | base-ui (LinkedSelect) | 1 día |
| 4 | — | 1 + base-ui (Cron*) | 1.5 días |
| 5 | — | Q-06 | 2 días |

Total estimado: **~8.5 días** (sin fase 5: ~6.5 días).