---
doc: affiliate/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

La mejora de la extensión `affiliate` está completa cuando TODOS los siguientes criterios están verdes.

## Dashboard admin

- [ ] `AffiliateDashboard.vue` renderiza 6 `StatCard` (FR-001) con: partners activos, referidos pendientes, conversión %, comisiones pendientes €, pagadas este mes €, MRR atribuido €.
- [ ] `StatCard` de "pagadas este mes" muestra `delta` vs mes anterior.
- [ ] Renderiza 1 `TrendChart` (FR-002) con monthlyTrend (12 meses, area).
- [ ] Renderiza 1 `BarChartCard` (FR-003) con top 10 partners revenue (horizontal).
- [ ] Renderiza 1 `DonutChartCard` (FR-004) con statusDistribution (pending/approved/paid) + centerValue total.
- [ ] Renderiza 1 `GaugeChartCard` (FR-005) con conversionRate + thresholds.
- [ ] Todos los componentes importados de `@base/ui-app/components/` (no inline).
- [ ] Loading state con skeletons por card/chart.
- [ ] Empty state cuando no hay datos (FR-002 base).

## Dashboard portal

- [ ] `pages/app/portal/index.vue` renderiza 4 `StatCard` (FR-010) + 1 `TrendChart` (FR-011).
- [ ] Consume `GET /affiliate/portal/dashboard` (FR-041).
- [ ] Afiliado sin comisiones ve 0 sin error.

## Backend

- [ ] `AffiliateDashboardService.getDashboard()` retorna los KPIs nuevos (FR-040) sin romper campos existentes.
- [ ] `GET /affiliate/portal/dashboard` implementado + testado (FR-041).
- [ ] `PATCH /affiliate/settings/report-cron` implementado + valida cron (FR-042).
- [ ] `PartnerService.create()` auto-genera `code` único (FR-043, Fase 4).
- [ ] `ReportService` lee `config.affiliate.reportCron` (FR-032, Fase 6).
- [ ] `extension.config.ts` con `registerAs('affiliate')` creado.
- [ ] RBAC: dashboard admin + settings = `RoleEnum.admin`; portal = `RoleEnum.affiliate` (o admin).
- [ ] Audit log de transiciones de status de comisión (NFR-006).
- [ ] Logger NestJS en todo (no console.log).

## Migración DB

- [ ] `pnpm migration:generate AddAffiliatePartnerCode` ejecutado (Fase 4).
- [ ] `pnpm migration:run` aplicado sin error.
- [ ] Columna `code` unique nullable (acepta null en existing rows, auto-fill en nuevos).

## Forms

- [ ] `partners/new.vue` muestra `code` auto-generado (FR-020).
- [ ] `referrals` form usa `LinkedSelect` partner→cliente (FR-021).
- [ ] `commissions/new.vue` (nuevo) usa `LinkedSelect` referral→project + previsualización cálculo (FR-022).
- [ ] Auto-fill email al elegir cliente (FR-023).
- [ ] NINGUNA comisión se calcula en frontend — previsualización es informativa (T-01).

## Scheduling

- [ ] `pages/app/affiliate/settings.vue` existe con `CronScheduleEditor` (FR-030) modo monthly.
- [ ] `CronNextRunsPreview` (FR-031) renderiza 5 próximas ejecuciones.
- [ ] Persistencia via `PATCH /affiliate/settings/report-cron`.
- [ ] UI documenta que aplica al próximo restart (R-03, Q-005).

## i18n

- [ ] Creado `apps/front/i18n/locales/es/affiliate.json` con namespace `affiliate`:
  - `affiliate.dashboard.kpi.*` (labels de 6 StatCards).
  - `affiliate.commission.status.{pending,approved,paid,rejected}`.
  - `affiliate.chart.*` (títulos, empty-states).
  - `affiliate.form.*` (labels de forms).
  - `affiliate.settings.cron.*` (labels de scheduling).
- [ ] Creado `apps/front/i18n/locales/en/affiliate.json` con las mismas keys.
- [ ] Ningún string user-facing hardcodeado.

## Testing

- [ ] Backend: test unit de `AffiliateDashboardService` cubriendo KPIs nuevos (happy + sin datos).
- [ ] Backend: test de `PartnerService.create()` auto-generate code (unicidad, colisión, 3 intentos).
- [ ] Backend: test de `PATCH /affiliate/settings/report-cron` (cron válido + inválido 400).
- [ ] Backend: test de `GET /affiliate/portal/dashboard` (ownership — partner no ve datos ajenos).
- [ ] Frontend: test component de `AffiliateDashboard.vue` (render 6 StatCards + 4 charts).
- [ ] Frontend: test de form commission previsualización (FR-022).
- [ ] Tests usan `it("should ...")` (regla ESLint).

## Quality gates

- [ ] `pnpm lint` verdes (back + front).
- [ ] `pnpm check-types` verdes (back + front).
- [ ] `pnpm format` (Prettier) aplicado.
- [ ] `pnpm test` verde.

## Documentación

- [ ] `docs/extensions/affiliate.md` actualizado con: nuevos endpoints (`/portal/dashboard`, `/settings/report-cron`), campo `code`, config `registerAs('affiliate')`, features nuevas.
- [ ] `pnpm docs:sync` ejecutado — `docs/ARCHITECTURE.md` regenerado sin error.
- [ ] YAML frontmatter de `affiliate.md` válido.

## Cierre

- [ ] Decisiones clave guardadas en Engram (`mem_save`):
  - D-01 KPIs extendidos.
  - D-02 cron config-driven.
  - D-03 auto-generate code.
  - T-01 previsualización informativa.
  - Q-006 definición MRR atribuido (proxy).
- [ ] Commit convencional: `feat(affiliate): dashboards + automated forms + visual scheduling`.
- [ ] PR creado referenciando `docs/prds/affiliate/`.
- [ ] PR referencia al PRD base (`docs/prds/base-ui-components/`) por FR-NNN consumidos.
- [ ] Q-009 (componentes base nuevos: CommissionStatusBadge, ReferralLinkDisplay) reportado al PRD base (issue o PR al catálogo).