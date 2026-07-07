---
doc: affiliate/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

La extensión `affiliate` ya existe y funciona (partners, referrals, commissions, portal self-service, reporte mensual por cron). Pero su UI es pobre: el dashboard admin muestra 4 KPIs estáticos + 2 tablas HTML crudas, el portal no tiene dashboard, los forms exigen tipeo manual (código de partner, email del cliente, importe de comisión), y el cronjob de reporte (`0 23 28-31 * *`) es ilegible para operadores. Este PRD especifica la mejora de UX usando los componentes base del catálogo (`docs/prds/base-ui-components/`), sin reescribir el backend ni cambiar el modelo de datos.

## Problema

- **Dashboard admin pobre**: `AffiliateDashboard.vue` renderiza 4 stats con clases DaisyUI `.stat` crudas (sin delta, sin icono, sin animación) y 2 tablas HTML sin charts. `AffiliateDashboardService` expone solo 5 métricas (activePartners, pendingReferrals, pendingCommissionsTotal, paidThisMonth, topPartners). Faltan KPIs relevantes: conversión (pending→converted), MRR atribuido, churn de referidos, trend mensual, distribución por estado. No hay visual.
- **Portal sin dashboard**: `pages/app/portal/index.vue` existe pero no muestra KPIs del afiliado (solo links). El backend ya tiene `getPartnerSummary()` con pendingTotal/approvedTotal/paidTotal/paidThisMonth, pero el frontend no los renderiza como StatCards.
- **Forms manuales**: `pages/app/affiliate/partners/new.vue` exige tipear name, email, iban, commissionRate a mano. No auto-genera código de partner (no existe campo `code` aún — ver Q-002). `pages/app/affiliate/referrals/index.vue` exige elegir partner + clientId por ID numérico. Al crear comisión, el `baseAmount` y `commissionAmount` se calculan en backend, pero el form no previsualiza el cálculo al elegir proyecto. No hay `LinkedSelect` (partner filtra clientes).
- **Cron opaco**: `AffiliateReportService` declara `@Cron('0 23 28-31 * *')` hardcoded en código. Operador no puede ver/ajustar el schedule sin redeploy. No hay UI. El cron usa días 28-31 con guard de "último día del mes" en runtime — frágil y no obvious.

## Objetivos medibles

1. **Dashboard admin**: renderizar 6 StatCards + 1 TrendChart + 1 BarChartCard + 1 DonutChartCard + 1 GaugeChartCard, todos con datos reales del backend (que expone los KPIs nuevos).
2. **Portal dashboard**: renderizar 4 StatCards (pendingTotal, approvedTotal, paidTotal, paidThisMonth) + 1 TrendChart del afiliado.
3. **Forms automatizados**: crear partner con auto-generate de `code`; crear referral con `LinkedSelect` partner→cliente; crear comisión con previsualización de cálculo al elegir proyecto.
4. **Scheduling visual**: el cron del reporte mensual se edita con `CronScheduleEditor` (modo `monthly`) y muestra `CronNextRunsPreview`. Persistencia en config (ver Q-005).
5. **Reducción de tipeo**: forms pasan de ~8 campos manuales a ~3 + autocompletados.

## No-objetivos

- Cambiar el modelo de comisión (one-time vs recurring) — ver Q-001.
- Implementar payout automático (transferencia bancaria real) — ver Q-003.
- Multi-tier affiliate (comisión en cascada) — ver Q-004.
- Implementar los componentes base (eso es el PRD `base-ui-components` + `sdd-apply`).
- Refactorizar el backend de affiliate (services, entities, DTOs) — solo se añaden endpoints/queries para KPIs nuevos.
- Migrar el dashboard de CRM u otras extensiones.

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| StatCards en dashboard admin | 6 | Conteo en `AffiliateDashboard.vue` |
| Charts en dashboard admin | 3 (Trend + Bar + Donut) + 1 Gauge | Conteo en `AffiliateDashboard.vue` |
| StatCards en portal | 4 | Conteo en `pages/app/portal/index.vue` |
| Forms con LinkedSelect | 2 (referral, commission) | Conteo de imports `LinkedSelect` |
| Forms con auto-generate | 1 (partner code) | `partners/new.vue` |
| Cron editable visualmente | 1 (reporte mensual) | `CronScheduleEditor` en settings admin |
| Campos manuales reducidos | ~60% | Comparar antes/después en forms |
| Lint + type-check | passing | `pnpm lint` + `pnpm check-types` verdes |