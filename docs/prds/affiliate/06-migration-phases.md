---
doc: affiliate/06-migration-phases
title: "Fases de Migración"
status: draft
created: 2026-07-07
---

# Fases de Migración

Migración incremental del UI actual a los componentes base. Cada fase es independiente y deployable. No requiere big-bang.

## Fase 0 — Previas (bloqueante)

- [ ] PRD base `base-ui-components` implementado (StatCard, TrendChart, BarChartCard, DonutChartCard, GaugeChartCard, CronScheduleEditor, CronNextRunsPreview, LinkedSelect disponibles en `@base/ui-app/components/`).
- [ ] `cron-parser` + `cronstrue` aprobados (Q-001 base) e instalados.
- [ ] Plugin base ECharts registrado (DoD base).

## Fase 1 — Backend: KPIs extendidos (sin UI)

**Objetivo**: `GET /affiliate/dashboard` retorna los KPIs nuevos sin romper el frontend actual.

- [ ] Extender `AffiliateDashboardService.getDashboard()` con `conversionRate`, `mrrAttributed` (proxy Q-006), `churnedReferrals`, `monthlyTrend`, `statusDistribution`, `topPartners` (con `commissionsCount`).
- [ ] Mantener campos existentes (`activePartners`, `pendingReferrals`, `pendingCommissionsTotal`, `paidCommissionsThisMonth`, `topPartners`) para no romper `AffiliateDashboard.vue` actual.
- [ ] Nuevo endpoint `GET /affiliate/portal/dashboard` (affiliate role) con summary + monthlyTrend (FR-041).
- [ ] Tests unit del service cubriendo los nuevos KPIs (happy path + sin datos).
- [ ] **No se toca frontend** — el dashboard actual sigue funcionando con campos extra ignorados.

**Validación**: `pnpm test` verde. Endpoint responde con campos nuevos. Frontend actual sin cambios.

## Fase 2 — Frontend: Dashboard admin con componentes base

**Objetivo**: reescribir `AffiliateDashboard.vue` con StatCard/TrendChart/BarChartCard/DonutChartCard/GaugeChartCard.

- [ ] Reemplazar 4 `.stat` crudos por 6 `StatCard` (FR-001).
- [ ] Añadir `TrendChart` (FR-002) con monthlyTrend.
- [ ] Añadir `BarChartCard` (FR-003) con topPartners.
- [ ] Añadir `DonutChartCard` (FR-004) con statusDistribution.
- [ ] Añadir `GaugeChartCard` (FR-005) con conversionRate.
- [ ] Mover labels a `affiliate.json` (es/en).
- [ ] Mantener tablas de topPartners y recentCommissions debajo de los charts (no se eliminan — complementan).

**Validación**: dashboard renderiza 6 cards + 4 charts. `pnpm lint` + `pnpm check-types` verdes.

## Fase 3 — Frontend: Portal dashboard

**Objetivo**: `pages/app/portal/index.vue` muestra KPIs del afiliado.

- [ ] Consumir `GET /affiliate/portal/dashboard` (Fase 1).
- [ ] Render 4 `StatCard` (FR-010) + 1 `TrendChart` (FR-011).
- [ ] Mover links existentes (mis referencias, mis comisiones) debajo de los KPIs.

**Validación**: afiliado autenticado ve sus KPIs. Admin ve los mismos (o redirige a admin dashboard).

## Fase 4 — Backend: Auto-generate de partner code

**Objetivo**: `ext_affiliate_partner.code` existe y se auto-genera.

- [ ] `pnpm add:property -- --name=AffiliatePartner --property=code --kind=primitive --type=string` (o migration manual si el generador no cubre unique).
- [ ] `pnpm migration:generate AddAffiliatePartnerCode` + `pnpm migration:run`.
- [ ] `PartnerService.create()` genera `AFF-XXXXXX` si no se provee (FR-043).
- [ ] Validar unicidad + regenerar hasta 3 intentos.
- [ ] `findOne` y `findAll` retornan `code`.
- [ ] Test del auto-generate (unicidad, colisión).

**Validación**: POST `/affiliate/partners` retorna partner con `code`. Migration aplicada sin error.

## Fase 5 — Frontend: Forms automatizados

**Objetivo**: forms usan LinkedSelect + auto-fill + auto-generate visible.

- [ ] `partners/new.vue`: mostrar `code` auto-generado read-only tras crear (o previsualizar antes). FR-020.
- [ ] `referrals/index.vue` (o `new.vue`): `LinkedSelect` partner→cliente (FR-021). optionsB = clientes no referidos por partner.
- [ ] `commissions/new.vue` (nuevo page): `LinkedSelect` referral→project (FR-022) + previsualización cálculo.
- [ ] Auto-fill email al elegir cliente (FR-023).
- [ ] i18n de labels.

**Validación**: crear partner muestra code. Crear referral con LinkedSelect filtra clientes. Crear commission previsualiza importe.

## Fase 6 — Backend + Frontend: Scheduling visual

**Objetivo**: cron del reporte editable visualmente.

- [ ] Backend: `extension.config.ts` con `registerAs('affiliate')` + `reportCron` env var (FR-032). Q-005.
- [ ] Backend: `ReportService` lee `config.affiliate.reportCron` en vez de hardcoded.
- [ ] Backend: `PATCH /affiliate/settings/report-cron` (FR-042) valida cron + persiste override.
- [ ] Frontend: `pages/app/affiliate/settings.vue` con `CronScheduleEditor` (FR-030) + `CronNextRunsPreview` (FR-031).
- [ ] Documentar que aplica al próximo restart (R-03).

**Validación**: admin edita cron, ve preview, guarda. Backend lee nueva config al restart.

## Fase 7 — Cierre

- [ ] `pnpm lint` + `pnpm check-types` verdes (back + front).
- [ ] `pnpm test` verde.
- [ ] `docs/extensions/affiliate.md` actualizado con nuevos endpoints + features.
- [ ] `pnpm docs:sync` ejecutado.
- [ ] Commit convencional (`feat(affiliate): dashboards + forms + scheduling visual`).
- [ ] PR creado referenciando este PRD.
- [ ] Decisiones clave en Engram (`mem_save`).