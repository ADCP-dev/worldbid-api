---
doc: stripe/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Riesgos técnicos

### R-01 — Webhook duplicado causa doble write (CRÍTICO)
**Riesgo**: Stripe reenvía webhooks si no recibe 200. Sin idempotencia, `handleCheckoutCompleted` puede crear suscripción duplicada o sobreescribir estado.
**Probabilidad**: Media (Stripe retry estándar en 3h, 6h, 24h...).
**Impacto**: Alto — dinero real, doble cobro o estado inconsistente.
**Mitigación**: FR-401/FR-402 — tabla `ext_stripe_webhook_event` con `event.id` único. Check antes de procesar.
**Trade-off**: 1 tabla + 1 write extra por webhook. Overhead despreciable.

### R-02 — Sync drift entre Stripe y DB local
**Riesgo**: Webhook perdido (downtime backend, Stripe retry agotado, network) → DB local desactualizada para siempre.
**Probabilidad**: Baja-Media.
**Impacto**: Medio — dashboard muestra datos stale, PlanGuard puede permitir/denegar erróneamente.
**Mitigación**: FR-302 cronjob reconciliación diaria configurable. Compara status/period end de cada sub de Stripe vs local.

### R-03 — Auto-gen de price falla a mitad de operación
**Riesgo**: `PlansService.create` con `autoGeneratePrice=true` → crea price en Stripe OK → falla persistencia local → price huérfano en Stripe.
**Probabilidad**: Baja (DB write raramente falla).
**Impacto**: Medio — price huérfano, basura en Stripe Dashboard.
**Mitigación**: FR-202 — rollback: si persistencia local falla tras crear price en Stripe, intentar `stripe.prices.update(price, {active:false})` o marcar `metadata.orphan=true`. Log warning.
**Trade-off**: rollback best-effort, no transaccional cross-system. Aceptable (intervención manual rara).

### R-04 — Stripe API rate limits en sync
**Riesgo**: Sync diario con muchas suscripciones → `stripe.subscriptions.list` paginado puede tocar rate limit (100 req/s en modo test, 100/s prod con bursting).
**Probabilidad**: Baja (< 10k subs).
**Impacto: Bajo — sync lento.
**Mitigación**: Paginación `limit=100`, sleep entre páginas si necesario, log de progreso. NFR-002 cubre 10k.

### R-05 — Cron timezone mal interpretado
**Riesgo**: Cron string sin timezone explícita → corre en UTC vs local → sync a las 3am local en vez de 3am UTC.
**Mitigación**: NFR-008 — timezone persistido en `ext_stripe_sync_config.timezone`. Default UTC. UI clara.

## Riesgos de seguridad

### R-06 — Webhook sin firma válida (CRÍTICO)
**Riesgo**: Attacker fakes webhook → cambia estado suscripción → acceso gratuito.
**Impacto**: Alto — bypass de pago.
**Mitigación**: NFR-005 — `constructEvent` obligatorio. 400 si signature inválida. Logger.error.
**Ya implementado** en `stripe.service.constructWebhookEvent`.

### R-07 — PCI scope
**Riesgo**: Loggear pan/card data → violación PCI-DSS.
**Mitigación**: Stripe maneja todo card data. Backend nunca toca PAN. Logger filtra `card.*` fields de payloads. Webhook event payload persistido en `ext_stripe_webhook_event.payload` jsonb — sanitizar antes de guardar (stripe eventos no incluyen PAN por diseño, pero validar).
**Trade-off**: payload raw útil para debugging vs riesgo. Mitigado con sanitización de fields sensibles.

### R-08 — Dashboard expone datos financieros a no-admin
**Mitigación**: FR-501 — `RolesGuard` + `@Roles(RoleEnum.admin)` en `MetricsController`. Front: ruta `/app/stripe/metrics` con admin middleware.

## Riesgos de performance

### R-09 — Dashboard query pesada
**Riesgo**: Agregación MRR sobre 10k+ subs con joins plan+price lenta.
**Mitigación**: NFR-002 — índices en `ext_stripe_subscription(status, currentPeriodEnd, planId)`. Query SQL directa, no ORM. Cache opcional (60s) si needed.

## Trade-offs decididos

### T-01 — Tabla `ext_stripe_webhook_event` vs Redis idempotency key
**Decisión**: Tabla Postgres.
**Sacrificado**: Latencia ligeramente mayor (DB write vs Redis SETNX).
**Ganado**: No añade dependencia Redis obligatoria. Persistencia durable. Queryable para auditoría.
**Por qué**: Robustez > velocidad en webhooks de dinero.

### T-02 — `@Cron` (ScheduleModule) vs Bull queue
**Decisión**: `@nestjs/schedule` para cron. Bull solo si ya hay queue compleja.
**Sacrificado**: Cola distribuida, retries, backoff.
**Ganado**: Simplicidad. Sync es job único, no necesita paralelismo.
**Por qué**: YAGNI. Bull es overhead para 1 job diario. [NEEDS CLARIFICATION: ver Q-01]

### T-03 — Auto-gen price en `PlansService` vs endpoint separado
**Decisión**: Flag `autoGeneratePrice` en `POST /stripe/plans`.
**Sacrificado**: Separación de concerns menos pura.
**Ganado**: 1 endpoint, 1 form submit, cero doble input.
**Por qué**: UX > purismo arquitectónico para form admin.

### T-04 — Dashboard metrics en DB vs Stripe Sigma/API
**Decisión**: Agregaciones en Postgres local.
**Sacrificado**: Datos "oficiales" viven en Stripe; posible desync refleja dashboard local.
**Ganado**: Rápido, no gasta Stripe API quota, funciona offline de Stripe.
**Por qué**: Local es source of truth para UX interna; sync job mantiene alineado.

### T-05 — No multi-cuenta Stripe
**Decisión**: Single account.
**Sacrificado**: Marketplaces / multi-tenant con Stripe Connect.
**Ganado**: Modelo de datos simple, `stripeCustomerId` en `UserEntity` simple.
**Por qué**: YAGNI; Q-03 abierta si surge necesidad.