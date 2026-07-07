---
doc: cms-audit/06-migration-phases
title: "Fases de Implementación"
status: draft
created: 2026-07-07
---

# Fases de Implementación

> No es un refactor de `cms` parent (que permanece read-only). Es la implementación incremental de la nueva extensión `cms-audit` desde cero.

## Fase 0 — Scaffolding

**Objetivo**: estructura de extensión creada via generador.

**Entregables**:
- Carpeta `apps/back/src/extensions/cms-audit/` con `extension.manifest.ts`, `extension.module.ts`, `extension.config.ts`.
- Frontend `apps/front/extensions/cms-audit/` con `nuxt.config.ts` (alias `@cms-audit`).
- `pnpm generate:extension` ejecutado.

**Criterios de salida**: `pnpm dev` arranca sin errores; extensión aparece en logs de `ExtensionLoaderModule`.

**Riesgos**: dependencia de `cms` parent no resuelta si manifest está mal.

## Fase 1 — Backend núcleo (sin scheduling)

**Objetivo**: audits on-demand funcionando end-to-end.

**Entregables**:
- Entidades `ext_cms_audit_run`, `ext_cms_audit_finding` (via `pnpm migration:generate`).
- `AuditCheckRegistry` + 4 checks iniciales: `seo-meta-present`, `jsonld-present`, `translations-complete`, `hardcode-table`.
- `AuditService.createRun`, `AuditProcessor` (BullMQ).
- Controllers: `POST /runs`, `GET /runs`, `GET /runs/:id`, `GET /runs/:id/findings`.
- RBAC: permisos `cms-audit:read`, `cms-audit:run`.

**Criterios de salida**: POST a `/runs` encola y completa; GET retorna findings persistidas; tests de integración verdes.

**Riesgos**: N+1 queries (mitigar con batch).

## Fase 2 — Dashboard backend

**Objetivo**: aggregate listo para frontend.

**Entregables**:
- `DashboardService.aggregate()` — score, distribución por tipo y severidad, tendencia últimas 12.
- `GET /dashboard` endpoint con cache TTL 60s.
- Tests unitarios del aggregate.

**Criterios de salida**: response < 500ms; datos coherentes con última run.

## Fase 3 — Frontend dashboard

**Objetivo**: dashboard visual consume componentes base.

**Entregables**:
- `AuditDashboard.vue` con `StatCard` × 4, `GaugeChartCard`, `BarChartCard`, `DonutChartCard`, `TrendChart`.
- `useCmsAuditDashboard.ts` (TanStack Query).
- `runs.vue` (DataTable histórico), `runs/[id].vue` (detalle findings).
- i18n `cms-audit.json` es/en.
- Sidebar nav plugin.

**Criterios de salida**: dashboard renderiza con datos de fase 2; responsive; ARIA.

**Bloqueante**: catálogo base-ui-components debe estar implementado.

## Fase 4 — Forms automatizados

**Objetivo**: creación de runs con auto-config.

**Entregables**:
- `AuditRunForm.vue` con `LinkedSelect` (target + profile), `scope` selector, auto-selección de checks.
- POST a `/runs` con payload correcto.
- Redirección a `/runs/:id` con polleo de status.

**Criterios de salida**: operador no técnico lanza una audit en < 30s sin docs.

## Fase 5 — Scheduling

**Objetivo**: audits recurrentes.

**Entregables**:
- `CronScheduleEditor` + `WeekdayPicker` + `CronNextRunsPreview` integrados en form (toggle "recurrente").
- Entidad `ext_cms_audit_run_config` (cron, profile, scope, activo).
- `POST /runs/schedule`, `DELETE /runs/schedule/:id`.
- `OnModuleInit` re-registra crons al boot desde DB.
- `SchedulerRegistry` dinámico.

**Criterios de salida**: schedule persiste tras restart; próxima ejecución mostrada correctamente.

**Riesgos**: R-05 (crons perdidos tras restart).

## Fase 6 — Checks restantes + pulido

**Objetivo**: catálogo completo de checks + UX.

**Entregables**:
- Checks faltantes: `jsonld-type` (BlogPosting), `hreflang-valid`, `canonical-present`, `og-image-present`, `robots-policy-valid`, `sitemap-integrated`.
- Filtros en tabla de findings.
- Empty-states y CTAs.
- Tests e2e del flujo completo.

**Criterios de salida**: ≥ 10 checks; lint/type-check verdes; DoD cumplido.

## Estrategia de rollback

Cada fase es additive (no toca `cms` parent). Rollback = eliminar carpeta `extensions/cms-audit/` + revertir migración. El `ExtensionLoaderModule` saltea la extensión si falta, sin romper el resto.