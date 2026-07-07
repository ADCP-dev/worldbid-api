---
doc: stripe/06-migration-phases
title: "Fases de Migración"
status: draft
created: 2026-07-07
---

# Fases de Migración

Refactor incremental sobre extensión existente. Cada fase entregable y mergeable de forma independiente.

## Fase 1 — Webhook idempotency (CRÍTICO, primero)

**Objetivo**: Garantizar que webhooks duplicados no causen doble write.

**Entregables**:
- Nueva entity `WebhookEventEntity` (`ext_stripe_webhook_event`) — campos: `eventId` (unique), `type`, `status` (enum processing/done/failed), `payload` (jsonb), `error` (text nullable), `createdAt`, `updatedAt`.
- Migración: `pnpm migration:generate AddStripeWebhookEvent` + `pnpm migration:run`.
- `stripe.service.handleWebhookEvent`: check `WebhookEventEntity` antes de dispatch. Insert al start, update al finish.
- `WebhooksService.handleEvent`: integra el guard.

**Criterios de salida**:
- Test: enviar mismo `event.id` 2x → 1 row en `ext_stripe_subscription` con estado final correcto.
- Test: evento con `status=failed` se reprocesa.

**Riesgos**: payload jsonb puede ser grande. Mitigado: limitar tamaño, truncar si > 1MB.

**Rollback**: drop tabla, revert service. Webhooks vuelven a flujo actual (non-idempotent, pero funcional).

---

## Fase 2 — Dashboard backend metrics

**Objetivo**: Exponer agregaciones de billing vía API.

**Entregables**:
- `MetricsService` con métodos: `getOverview(from, to)`, `getMrrTrend(months)`, `getRevenueByPlan()`, `getStatusDistribution()`, `getChurnRate(from, to)`, `getUpcomingRenewals(days)`.
- `MetricsController`: `GET /stripe/metrics/overview`, `/mrr-trend`, `/revenue-by-plan`, `/status-distribution`, `/churn-rate`, `/upcoming-renewals`. Todos admin.
- Índices DB: `ext_stripe_subscription(status)`, `(currentPeriodEnd)`, `(planId)`.
- Tests unitarios `metrics.service.spec.ts`.

**Criterios de salida**:
- `GET /overview` responde < 500ms con 10k suscripciones seedeadas.
- RBAC: non-admin → 403.

**Riesgos**: queries SQL complejas. Mitigado: explain plan, índices.

**Rollback**: borrar controller/service/migración de índices.

---

## Fase 3 — Dashboard frontend

**Objetivo**: Página admin con componentes `@base/ui-app/charts/`.

**Entregables**:
- `@stripe/pages/app/stripe/metrics.vue` con StatCard × 5 (MRR, ARR, activas, trials, fallos), TrendChart MRR, BarChartCard revenue por plan, DonutChartCard status, GaugeChartCard churn.
- `useStripeMetricsQuery` (TanStack) en `@stripe/composables/useStripe.ts`.
- i18n keys `stripe.*` en `apps/front/i18n/locales/{es,en}/`.
- StatCard delta calculado vs período anterior.

**Depende de**: Fase 2.

**Criterios de salida**:
- Página renderiza con datos mock.
- Responsive mobile (StatCard stack vertical).
- Theme dark/light via `useThemeColors()`.

**Rollback**: borrar página + composable entries.

---

## Fase 4 — Plan form automatizado

**Objetivo**: Crear plan con auto-gen de price en 1 submit.

**Entregables**:
- `PlansService.create` extiende: si `autoGeneratePrice=true` → crea price en Stripe, persiste local, enlaza.
- `CreatePlanDto` añade campos: `autoGeneratePrice`, `productLookupKey?`, `priceCurrency?`, `priceUnitAmount?`, `priceInterval?`, `priceType?`.
- `PlanFormV2.vue` con `LinkedSelect` (FR-021) Product→Price + switch auto-gen + fields condicionales.
- Tests: `plans.service.spec.ts` cubre auto-gen y fallback.

**Criterios de salida**:
- Crear plan con auto-gen → 1 price en Stripe + 1 plan local + `priceId` enlazado.
- Crear plan sin auto-gen → flujo actual sin regresión.
- Stripe API fail → 502, sin writes locales.

**Riesgos**: R-03 orphan price. Mitigado: rollback best-effort.

**Rollback**: revert DTO + service + form. Planes existentes no afectados.

---

## Fase 5 — Sync & reconciliation

**Objetivo**: Cronjob configurable que reconcilia local con Stripe.

**Entregables**:
- `SyncConfigEntity` (`ext_stripe_sync_config`, singleton id=1): `cron`, `enabled`, `timezone`, `lastRunAt`, `lastDriftCount`, `lastError`, `updatedAt`.
- `SyncService.runReconciliation()`: lista subs de Stripe, upsert local si diff.
- `SyncSchedulerService` con `@Cron` dinámico leído de config.
- `SyncController`: `POST /stripe/sync/run`, `GET /stripe/sync/config`, `PATCH /stripe/sync/config`.
- `SyncConfigPanel.vue` con `CronScheduleEditor` + `WeekdayPicker` + `FormSwitch`.
- Añadir `@nestjs/schedule` dep si no está (Q-01).

**Depende de**: Fase 1 (idempotency) para evitar conflictos con webhooks durante sync.

**Criterios de salida**:
- Cron dispara sync según schedule.
- Sync detecta drift (sub activa en Stripe, local cancelada) y corrige.
- Manual trigger 409 si ya corriendo.

**Riesgos**: R-04 rate limits. Mitigado: paginación.

**Rollback**: `enabled=false` en config. Job no corre. Tabla opcional de limpiar.

---

## Orden recomendado

```
Fase 1 (idempotency) ──► Fase 2 (metrics API) ──► Fase 3 (dashboard UI)
                                                       │
Fase 4 (plan form) ◄──────────────────────────────────┘
                                                       │
Fase 5 (sync) ◄────────────────────────────────────────┘
                         (depende de Fase 1)
```

Fase 1 **bloqueante** para Fase 5. Fases 2-4 paralelizables tras Fase 1.