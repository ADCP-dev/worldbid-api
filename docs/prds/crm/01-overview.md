---
doc: crm/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

La extensión CRM ya funciona a nivel backend (CRUD completo de clientes, contactos, interacciones, proyectos, orígenes, estados) y frontend (dashboard con KPIs en `stat` cards manuales de DaisyUI, tablas, forms con `FormInput`/`FormSelect` base). Pero el dashboard actual es visualmente pobre: KPIs planos sin trends, pipeline sin funnel chart, distribución de orígenes con barras HTML manuales en vez de `BarChartCard`, y los forms requieren tipeo repetitivo sin automatización (elegir cliente → contacto NO están encadenados, empresa NO se auto-fill desde dominio de email). Este PRD eleva CRM a dashboards informativos con el catálogo base, automatiza forms para reducir tipeo, y explora scheduling de reportes/seguimientos.

## Problema

- **Dashboard plano**: `CrmDashboard.vue` usa `stat` cards de DaisyUI con números sueltos. No hay trends (sparklines), no hay donut de distribución de status, no hay bar chart real de pipeline. Los datos existen (`CrmDashboardService` retorna `clientsByStatus`, `clientsByOrigin`, `projectsByStatus`, `recentInteractions`) pero la UI no los visualiza con charts reutilizables.
- **Pipeline sin funnel visual**: hoy se renderiza como cards compactas inline, no como `BarChartCard` horizontal comparando stages.
- **Forms manuales tediosos**: `clients/new.vue` pide `companyName`, `nif`, `email` como campos sueltos. No hay auto-fill de `companyName` desde el dominio del email (`jane@acme.com` → "Acme"). Al crear interacción, NO hay `LinkedSelect` para encadenar cliente → contacto (hoy son inputs desacoplados).
- **Sin trends temporales**: no hay endpoint que retorne series temporales (clientes nuevos por día/semana, interacciones por semana). `CrmDashboardService.getDashboard()` retorna solo agregados atemporales.
- **Sin asignación automática**: no existe campo `ownerId` en `CrmClientEntity`. Los clientes no tienen "vendedor asignado". No hay round-robin assignment.
- **Sin MRR/Churn**: `CrmProjectEntity` tiene `price` y `paymentStatus`, pero no se calcula MRR (Monthly Recurring Revenue) ni churn rate en el dashboard.
- **Sin scheduling**: CRM no define cronjobs. No hay weekly report automático ni follow-up reminders. `bullmq` + `@nestjs/schedule` están instalados pero CRM no los usa.

## Objetivos medibles

1. **Dashboard con catálogo base**: 4+ `StatCard`, 1+ `TrendChart`, 1+ `BarChartCard`, 1+ `DonutChartCard` consumidos en `CrmDashboard.vue` — cero charts inline manuales.
2. **Forms automatizados**: `LinkedSelect` usado en ≥2 forms (crear interacción cliente→contacto, crear proyecto cliente→status). Auto-fill de `companyName` desde dominio de email en `clients/new.vue`.
3. **Trends temporales**: nuevo endpoint `/crm/dashboard/trends?range=30d|90d` retornando series temporales (clientes nuevos, interacciones, pipeline value).
4. **MRR visible**: `StatCard` con MRR calculado desde `CrmProjectEntity.price` filtrando `paymentStatus='paid'` + `status='active'`.
5. **Scheduling (⚠️ Ask first)**: si Q-003 se aprueba, `CronScheduleEditor` (FR-006 base) para weekly report + follow-up reminders.
6. **Cero duplicación**: ningún chart/KPI implementado ad-hoc en `extensions/crm/components/` — todo via `@base/ui-app/components/`.

## No-objetivos

- Implementar el código (eso es `sdd-apply`).
- Migrar `extensions/analytics/` (se trata en su PRD).
- Integración nativa con Gmail/Outlook (ver Q-001 — open question).
- Enriquecimiento automático vía LinkedIn/Clearbit APIs (ver Q-002 — open question).
- Import/export CSV masivo (ver Q-006 — open question).
- Mobile app nativa (el dashboard es responsive web).
- Refactor del backend CRUD (funciona, solo se extiende con trends + owner + MRR).
- Sistema de widgets inyectables跨-extensiones (ver `docs/DECOUPLING.md` §15 — fuera de scope).

## KPIs

| KPI | Meta | Medición |
|-----|------|---------|
| `StatCard` en dashboard | ≥4 | Conteo en `CrmDashboard.vue` |
| `TrendChart` en dashboard | ≥1 | Conteo en `CrmDashboard.vue` |
| `BarChartCard` en dashboard | ≥1 | Conteo (pipeline por stage) |
| `DonutChartCard` en dashboard | ≥1 | Conteo (distribución status) |
| `LinkedSelect` en forms | ≥2 | Conteo en `pages/app/crm/**/new.vue` |
| Charts inline manuales en CRM | 0 | Búsqueda `stat`/barra HTML manual fuera de `@base/ui-app` |
| Tiempo de carga dashboard | < 500ms | Lighthouse / percebido |
| Campos manuales reducidos por auto-fill | ≥1 (`companyName`) | Diff vs form actual |
| Tests e2e dashboard | passing | Playwright suite CRM |
| Lint + type-check | passing | `pnpm lint` + `pnpm check-types` verdes |
| i18n keys CRM | cubiertos (es/en) | Namespace `crm` en `apps/front/i18n/locales/` |