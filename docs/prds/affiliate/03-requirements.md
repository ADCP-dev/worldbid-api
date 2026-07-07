---
doc: affiliate/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## Requisitos funcionales — Dashboard Admin

### FR-001 — Dashboard admin con 6 StatCards
THE SYSTEM SHALL render 6 `StatCard` (componente base FR-001 del PRD base) en `AffiliateDashboard.vue` con: partners activos, referidos pendientes, conversión (%), comisiones pendientes (€), comisiones pagadas este mes (€), MRR atribuido (€).
WHEN `delta` disponible THE SYSTEM SHALL mostrarlo (ej: pagadas este mes vs mes anterior).
IF `loading` THE SYSTEM SHALL mostrar skeleton por card.

### FR-002 — TrendChart de comisiones pagadas
THE SYSTEM SHALL render un `TrendChart` (base FR-002) con `data: {x: mes, y: commissionAmount pagado}[]` de los últimos 12 meses, `mode="area"`.
IF no hay datos THE SYSTEM SHALL mostrar empty-state.

### FR-003 — BarChartCard de top partners
THE SYSTEM SHALL render un `BarChartCard` (base FR-003) con `data: {label: partnerName, value: totalRevenue}[]` (top 10), `orientation="horizontal"`.
THE SYSTEM SHALL aceptar `title="Top partners por revenue"`.

### FR-004 — DonutChartCard de comisiones por estado
THE SYSTEM SHALL render un `DonutChartCard` (base FR-004) con `data: [{label:'Pendiente', value, color}, {label:'Aprobada',...}, {label:'Pagada',...}]`.
THE SYSTEM SHALL mostrar `centerValue` con el total de comisiones.

### FR-005 — GaugeChartCard de conversión
THE SYSTEM SHALL render un `GaugeChartCard` (base FR-005) con `value: conversionRate` (0-100), `unit="%"`, thresholds (verde ≥30%, amarillo ≥10%, rojo <10%).

## Requisitos funcionales — Dashboard Portal

### FR-010 — Portal dashboard con 4 StatCards
THE SYSTEM SHALL render 4 `StatCard` en `pages/app/portal/index.vue` con: comisiones pendientes (€), aprobadas (€), pagadas total (€), pagadas este mes (€).
THE SYSTEM SHALL consumir `GET /affiliate/portal/dashboard` (endpoint nuevo).
WHEN partner no tiene comisiones THE SYSTEM SHALL mostrar 0 sin error.

### FR-011 — Portal TrendChart personal
THE SYSTEM SHALL render un `TrendChart` con el trend mensual de comisiones pagadas del afiliado (12 meses).
IF el afiliado no tiene historial THE SYSTEM SHALL mostrar empty-state.

## Requisitos funcionales — Forms automatizados

### FR-020 — Auto-generate de partner code
WHEN admin crea partner via `partners/new.vue` THE SYSTEM SHALL auto-generar un `code` único (formato `AFF-XXXXXX`, 6 chars alfanuméricos) y mostrarlo read-only.
THE SYSTEM SHALL validar unicidad en backend antes de persistir.
IF colisión THE SYSTEM SHALL regenerar hasta 3 intentos.

### FR-021 — Form de referral con LinkedSelect
THE SYSTEM SHALL usar `LinkedSelect` (base FR-021) en `referrals/index.vue` para encadenar partner (A) → cliente (B), donde B options son los clientes NO referidos aún por ese partner.
WHEN partner seleccionado THE SYSTEM SHALL resetear cliente y cargar optionsB.
IF solo queda 1 cliente THE SYSTEM SHALL auto-seleccionarlo (`autoFill=true`).

### FR-022 — Form de commission con previsualización
THE SYSTEM SHALL usar `LinkedSelect` en `commissions/new.vue` para encadenar referral (A) → proyecto (B), donde B options son proyectos del cliente del referral con `paymentStatus='paid'`.
WHEN proyecto seleccionado THE SYSTEM SHALL previsualizar `commissionAmount = baseAmount × commissionRate` (rate del partner del referral) sin necesidad de tipear.
THE SYSTEM SHALL mostrar el cálculo en un `StatCard` o bloque informativo antes de submit.

### FR-023 — Auto-fill de email al elegir cliente
WHEN admin selecciona un cliente existente en referral/commission form THE SYSTEM SHALL auto-rellenar el campo email (read-only) desde el cliente elegido.
IF cliente no tiene email THE SYSTEM SHALL dejar el campo editable.

## Requisitos funcionales — Scheduling

### FR-030 — Editor visual del cron de reporte
THE SYSTEM SHALL render un `CronScheduleEditor` (base FR-010) en `pages/app/affiliate/settings.vue` con `mode="monthly"` para editar el cron del reporte mensual.
THE SYSTEM SHALL persistir el cron via `PATCH /affiliate/settings/report-cron` (endpoint nuevo admin-only).
WHEN cron guardado THE SYSTEM SHALL mostrar toast de éxito.

### FR-031 — Preview de próximas ejecuciones
THE SYSTEM SHALL render un `CronNextRunsPreview` (base FR-013) bajo el editor con `:count=5`.
WHEN cron inválido THE SYSTEM SHALL mostrar error y no permitir guardar.

### FR-032 — Backend config-driven cron
THE BACKEND SHALL leer el cron de `config.affiliate.reportCron` (env var `AFFILIATE_REPORT_CRON`, default `'0 23 28-31 * *'`).
THE BACKEND SHALL aceptar override runtime via DB (tabla `ext_affiliate_config` o `metadata` del partner admin — ver Q-005).
IF cron runtime cambia THE BACKEND SHALL aplicar al siguiente bootstrap (ver R-04 PRD base).

## Requisitos funcionales — Endpoints backend

### FR-040 — GET /affiliate/dashboard extendido
THE BACKEND SHALL extender `AffiliateDashboardService.getDashboard()` para retornar además: `conversionRate`, `mrrAttributed`, `churnedReferrals`, `monthlyTrend: {x,y}[]`, `statusDistribution: {label,value,color}[]`, `topPartners` con `commissionsCount`.
WHEN sin datos THE BACKEND SHALL retornar arrays vacíos y rates en 0 (no null).

### FR-041 — GET /affiliate/portal/dashboard (nuevo)
THE BACKEND SHALL exponer `GET /affiliate/portal/dashboard` (affiliate role) retornando `{summary: {pendingTotal, approvedTotal, paidTotal, paidThisMonth}, monthlyTrend: {x,y}[]}`.

### FR-042 — PATCH /affiliate/settings/report-cron (nuevo)
THE BACKEND SHALL exponer `PATCH /affiliate/settings/report-cron` (admin) con body `{cron: string}`.
THE BACKEND SHALL validar sintaxis cron (5 campos) via `cron-parser`.
IF inválido THE BACKEND SHALL retornar 400.

### FR-043 — Auto-generate de code en POST /affiliate/partners
THE BACKEND SHALL generar `code` automáticamente en `PartnerService.create()` si no se provee.
THE BACKEND SHALL validar unicidad y regenerar en colisión.

## Requisitos no funcionales (NFR-NNN)

### NFR-001 — Performance dashboard
WHEN dashboard renderiza THE SYSTEM SHALL responder en < 500ms (backend) y < 200ms (render charts).
THE BACKEND SHALL usar queries agregadas (SUM/COUNT) con índices existentes (`referralId`, `projectId`, `status`).

### NFR-002 — RBAC
THE SYSTEM SHALL restringir `GET /affiliate/dashboard`, `PATCH /affiliate/settings/report-cron` a `RoleEnum.admin`.
THE SYSTEM SHALL restringir `GET /affiliate/portal/dashboard` a `RoleEnum.affiliate` (o admin).
THE BACKEND SHALL validar ownership en portal (partner solo ve sus propios datos).

### NFR-003 — i18n
THE SYSTEM SHALL sourcear todos los labels de StatCards, charts, forms desde `apps/front/i18n/locales/{es,en}/affiliate.json` (namespace `affiliate`).
THE SYSTEM SHALL traducir estados de comisión (pending/approved/paid), días de semana (via base FR-011), empty-states.

### NFR-004 — Accesibilidad
THE SYSTEM SHALL heredar ARIA/keyboard de los componentes base (FR-001..FR-021 base).
THE SYSTEM SHALL añadir `aria-label` a los StatCards con icono.

### NFR-005 — Dinero: precisión
THE BACKEND SHALL mantener `decimal(10,2)` en commissionAmount y `decimal(5,4)` en commissionRate.
THE FRONTEND SHALL formatear con `Intl.NumberFormat(locale, {style:'currency', currency:'EUR'})` (ya existe helper en `AffiliateDashboard.vue`).

### NFR-006 — Seguridad payout
THE SYSTEM SHALL NUNCA exponer IBAN en endpoints admin salvo en vista de detalle de partner.
THE SYSTEM SHALL loggear toda transición de status de comisión (audit trail).

## Criterios de aceptación (Given/When/Then) — ejemplos

**Dashboard admin KPIs**:
- GIVEN admin autenticado
- WHEN navega a `/app/affiliate`
- THEN ve 6 StatCards + TrendChart + BarChartCard + DonutChartCard + GaugeChartCard con datos reales.

**Form commission previsualización**:
- GIVEN admin en `commissions/new.vue`, selecciona referral R (partner con rate 0.10) y proyecto P (price 1000€, paid)
- WHEN proyecto seleccionado
- THEN ve previsualización "100.00 €" (1000 × 0.10) antes de submit.

**Cron editor**:
- GIVEN admin en `affiliate/settings.vue`, cron actual `0 23 28-31 * *`
- WHEN cambia a modo monthly, día 15, time 10:00
- THEN `CronScheduleEditor` emite `0 10 15 * *` y `CronNextRunsPreview` muestra próximas 5 ejecuciones.