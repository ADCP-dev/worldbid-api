---
doc: stripe/03-requirements
title: "Requisitos"
status: draft
created: 2026-07-07
---

# Requisitos

## Requisitos funcionales — Dashboard (FR-100s)

### FR-101 — Dashboard de métricas admin
THE SYSTEM SHALL expose `GET /api/v1/stripe/metrics/overview` returning `{mrr, arr, activeSubscriptions, trials, failedPayments, upcomingRenewals, churnRate, revenueByPlan[], statusDistribution[], mrrTrend[]}`.
IF caller is not admin THE SYSTEM SHALL return 403.
WHEN `from` and `to` query params are provided THE SYSTEM SHALL scope aggregations to that range, else default to last 30 days.

### FR-102 — StatCard MRR (ref FR-001 base)
THE SYSTEM SHALL render MRR as a `StatCard` with `value` (sum of active subs `unitAmount/100` monthly-normalized), `label="MRR"`, `delta` (vs previous period), `icon="trending-up"`.
WHEN no active subscriptions exist THE SYSTEM SHALL show `value=0` and empty-state description.

### FR-103 — StatCard ARR (ref FR-001 base)
THE SYSTEM SHALL render ARR as `StatCard` with `value = MRR * 12`, `label="ARR"`, `delta` (vs previous period).

### FR-104 — StatCard suscripciones activas (ref FR-001 base)
THE SYSTEM SHALL render `StatCard` with `value` = count `status=active`, `label="Suscripciones activas"`, `delta` vs previous period.

### FR-105 — StatCard trials (ref FR-001 base)
THE SYSTEM SHALL render `StatCard` with `value` = count `status=trialing`, `label="Trials"`, `icon="clock"`.

### FR-106 — StatCard fallos de pago (ref FR-001 base)
THE SYSTEM SHALL render `StatCard` with `value` = count `status=past_due` + failed `invoice.payment_failed` events in range, `label="Fallos de pago"`, `icon="alert-triangle"`, delta down=success.

### FR-107 — TrendChart MRR (ref FR-002 base)
THE SYSTEM SHALL render `TrendChart` with `data` = MRR per month last 12 months, `mode="area"`, `height=120`.
IF no data in range THE SYSTEM SHALL show empty-state message.

### FR-108 — BarChartCard revenue por plan (ref FR-003 base)
THE SYSTEM SHALL render `BarChartCard` with `data = {label: planName, value: revenue}[]` sorted desc, `title="Revenue por plan"`, `orientation="horizontal"`.

### FR-109 — DonutChartCard status suscripciones (ref FR-004 base)
THE SYSTEM SHALL render `DonutChartCard` with `data = [{label:"Activas", value:N, color:success}, {label:"Past due", color:warning}, {label:"Canceladas", color:error}, {label:"Trial", color:info}]`, `centerLabel="Total"`, `centerValue=sum`.

### FR-110 — GaugeChartCard churn rate (ref FR-005 base)
THE SYSTEM SHALL render `GaugeChartCard` with `value = churnRate%` (canceladas en período / activas inicio período), `unit="%"`, thresholds: success<5, warning<10, error>=10.

### FR-111 — Próximos renewals
THE SYSTEM SHALL expose `GET /api/v1/stripe/metrics/upcoming-renewals?days=7` returning subscriptions with `currentPeriodEnd` within next N days.
THE SYSTEM SHALL render them as a `DataTable` (base) with columns: user, plan, fecha renewal, monto.

## Requisitos funcionales — Form automatizado (FR-200s)

### FR-201 — PlanFormV2 con auto-gen de price
THE SYSTEM SHALL render a plan form using `@base/ui-app` form components (`FormInput`, `FormTextArea`, `FormSelect`, `FormSwitch`) with a `LinkedSelect` (ref FR-021 base) for Product → Price.
WHEN `autoGeneratePrice` switch is ON THE SYSTEM SHALL hide the Price `LinkedSelect` and show price fields (currency, unitAmount, interval, type) to create a new Price in Stripe on submit.
WHEN `autoGeneratePrice` is OFF THE SYSTEM SHALL show the `LinkedSelect` Product→Price and bind existing `priceId`.

### FR-202 — Auto-gen price en backend
WHEN `POST /api/v1/stripe/plans` is called with `autoGeneratePrice=true` THE SYSTEM SHALL:
1. Validate product exists (by `productId` or `productLookupKey`).
2. Create Price in Stripe via `stripe.prices.create`.
3. Persist `PriceEntity` locally with returned `stripeId`.
4. Create `PlanEntity` linked to new `priceId`.
IF Stripe API call fails THE SYSTEM SHALL rollback (no local writes) and return 502 with error detail.

### FR-203 — LinkedSelect Product → Price (ref FR-021 base)
THE SYSTEM SHALL render `LinkedSelect` with `optionsA = products`, `optionsB = (productId) => prices of that product`.
WHEN A (product) changes THE SYSTEM SHALL reset B (price) and recompute options.
IF `autoFill=true` and product has exactly one price THE SYSTEM SHALL auto-select it.

### FR-204 — Sync bidireccional de products
THE SYSTEM SHALL expose `POST /api/v1/stripe/sync/products` (admin) that pulls products from Stripe and upserts local `ProductEntity` + `PriceEntity`.
WHEN a local product has `stripeId=null` THE SYSTEM SHALL create it in Stripe and store the returned ID.

## Requisitos funcionales — Scheduling & Sync (FR-300s)

### FR-301 — SyncConfigPanel con CronScheduleEditor (ref FR-010 base)
THE SYSTEM SHALL render a config panel using `CronScheduleEditor` (v-model: cron string) + `FormSwitch` (enabled) + `WeekdayPicker` (used by weekly mode of CronScheduleEditor).
THE SYSTEM SHALL persist config via `PATCH /api/v1/stripe/sync/config`.

### FR-302 — Cronjob de reconciliación
WHILE sync config `enabled=true` THE SYSTEM SHALL execute `SyncService.runReconciliation()` on the cron schedule from `ext_stripe_sync_config`.
The reconciliation SHALL:
1. List subscriptions from Stripe (paginated).
2. For each, upsert local `SubscriptionEntity` if status/period differs.
3. Log drift count to `Logger`.
4. Update `lastRunAt` and `lastDriftCount` in config.

### FR-303 — Sync manual trigger
THE SYSTEM SHALL expose `POST /api/v1/stripe/sync/run` (admin) to trigger reconciliation on demand.
WHEN sync is already running THE SYSTEM SHALL return 409 Conflict.

### FR-304 — SyncConfigEntity persistence
THE SYSTEM SHALL store sync config in `ext_stripe_sync_config` (singleton row, id=1) with fields: `cron`, `enabled`, `lastRunAt`, `lastDriftCount`, `lastError`, `updatedAt`.

## Requisitos funcionales — Webhooks robustos (FR-400s)

### FR-401 — Idempotencia webhooks
WHEN a webhook event is received THE SYSTEM SHALL first check `ext_stripe_webhook_event` for `event.id`.
IF `event.id` exists with `status=done` THE SYSTEM SHALL return 200 and not reprocess.
IF `event.id` exists with `status=processing` and `updatedAt` < 5 min ago THE SYSTEM SHALL return 200 and skip.
IF `event.id` exists with `status=failed` THE SYSTEM SHALL reprocess.

### FR-402 — Webhook event persistence
THE SYSTEM SHALL insert a row in `ext_stripe_webhook_event` with `(eventId, type, status, payload jsonb, createdAt, updatedAt)` before dispatching to handler.
THE SYSTEM SHALL update `status` to `done` or `failed` with `error` field after processing.

### FR-403 — Webhook events handled
THE SYSTEM SHALL handle (in addition to current): `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`. [NEEDS CLARIFICATION: añadir `customer.subscription.trial_will_end`, `payment_intent.payment_failed`?]

## Requisitos funcionales — RBAC

### FR-501 — Guards en endpoints nuevos
THE SYSTEM SHALL apply `AuthGuard('jwt')` + `RolesGuard` with `@Roles(RoleEnum.admin)` to: `MetricsController`, sync endpoints (`run`, `config`), `POST /stripe/sync/products`, `POST /stripe/plans` with auto-gen.
THE SYSTEM SHALL apply `PlanGuard` where current endpoints already do (no regression).

## Requisitos no funcionales (NFR-NNN)

### NFR-001 — Webhook idempotency
THE SYSTEM SHALL guarantee that processing the same `event.id` N times results in exactly 1 state change in `ext_stripe_subscription`.

### NFR-002 — Dashboard performance
WHEN metrics overview is requested with dataset of 10k subscriptions THE SYSTEM SHALL respond in < 500ms (DB query + serialization).

### NFR-003 — Money safety
THE SYSTEM SHALL never mutate `unitAmount` or currency in DB from dashboard queries (read-only aggregations). All monetary values stored in cents, displayed with `/100` formatting.

### NFR-004 — i18n
THE SYSTEM SHALL source all dashboard labels from `apps/front/i18n/locales/{es,en}/` under `stripe` namespace (e.g. `stripe.mrr`, `stripe.churn`, `stripe.revenueByPlan`).

### NFR-005 — Security — Stripe signature verification
THE SYSTEM SHALL verify `stripe-signature` header on every webhook using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`. Unverified payloads SHALL return 400 and be logged at `error` level.

### NFR-006 — Audit log
THE SYSTEM SHALL log every sync run (start, end, drift count, errors) via NestJS `Logger`. [NEEDS CLARIFICATION: ¿auditaría más formal en tabla `ext_stripe_sync_log`?]

### NFR-007 — Test mode preservation
IF `STRIPE_SECRET_KEY` is not set THE SYSTEM SHALL keep current test-mode behavior (StripeTestController) and skip sync/webhook real calls, logging warnings.

### NFR-008 — Cron timezone
THE SYSTEM SHALL interpret the cron schedule in the timezone configured in `ext_stripe_sync_config.timezone` (default: server `process.env.TZ` or UTC). [NEEDS CLARIFICATION: ver Q-06]