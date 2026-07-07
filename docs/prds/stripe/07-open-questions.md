---
doc: stripe/07-open-questions
title: "Open Questions"
status: draft
created: 2026-07-07
---

# Open Questions

## Q-01 — ¿`@nestjs/schedule` ya instalado? ¿O usamos Bull?

**Pregunta**: grep de `@Cron`/`@Processor`/`@nestjs/schedule` en `apps/back` devuelve vacío. ¿Está la dep en `package.json`? Si no, ¿añadimos `@nestjs/schedule` o reusamos Bull (ya en monorepo)?

**Impacto**: Bloqueante para Fase 5.
**Recomendación**: `@nestjs/schedule` — YAGNI, Bull es overhead para 1 job diario. Verificar `apps/back/package.json` antes de decidir.
**Decisión del agente**: Trade-off T-02 favorece `@nestjs/schedule`.

---

## Q-02 — Webhook retry policy de Stripe

**Pregunta**: ¿Stripe reenvía webhooks a las 3h/6h/24h? ¿Configuramos endpoint en Stripe Dashboard con retry policy custom? ¿Qué pasa si nuestro backend está caído 24h?

**Impacto**: No bloqueante (idempotency de Fase 1 cubre reprocesamiento), pero relevante para SLA.
**Recomendación**: Documentar policy default de Stripe (3 días retry). Sync job (Fase 5) cubre gap si webhook perdido definitivamente.

---

## Q-03 — ¿Soporte multi-cuenta Stripe?

**Pregunta**: ¿Necesitamos soportar múltiples Stripe accounts (ej: marketplace con Connect, o multi-tenant)?

**Impacto**: No bloqueante para v1. Arquitectura current asume single account (`stripeCustomerId` en `UserEntity`, un solo `STRIPE_SECRET_KEY`).
**Recomendación**: No en v1. Defer a Q separada si surge. Trade-off T-05.

---

## Q-04 — Tax/VAT automation

**Pregunta**: ¿Stripe Tax activo? ¿Calculamos VAT/tax nosotros o dejamos a Stripe? ¿Mostramos tax breakdown en dashboard?

**Impacto**: No bloqueante. `pdf-invoice.service` ya tiene campo `tax` (suma de `total_tax_amounts`).
**Recomendación**: Delegar 100% a Stripe Tax si activo. Dashboard no muestra tax breakdown en v1 (fuera scope, ver No-objetivos).

---

## Q-05 — Customer Portal embed vs redirect

**Pregunta**: ¿Embeber Customer Portal en iframe (Stripe soporta) o mantener redirect actual?

**Impacto**: No bloqueante. Redirect actual funciona (`stripe.service.createCustomerPortalForUser`).
**Recomendación**: Mantener redirect. Embed requiere configuración CSP y iframe-allowed-domains. YAGNI.

---

## Q-06 — Timezone del cron de sync

**Pregunta**: ¿Timezone del cron es UTC, server local, o configurable por admin? ¿Persistir en `ext_stripe_sync_config.timezone`?

**Impacto**: No bloqueante (NFR-008 propone default UTC + configurable).
**Recomendación**: UTC default + override por config. UI muestra timezone claramente.

---

## Q-07 — Definición exacta de MRR y churn

**Pregunta**:
- MRR: ¿suma simple de `unitAmount/100` mensual-normalizado de subs activas? ¿O MRR neto (nuetros - churn - downgrades + upgrades mid-cycle)?
- Churn: ¿gross churn (canceladas / activas inicio) o net churn (canceladas - nuevas reactivaciones)?

**Impacto**: Bloqueante para Fase 2 metrics (cálculo correcto).
**Recomendación**: v1 = definiciones simples (gross). MRR = suma unitAmount mensual-normalizado. Churn = canceladas en período / activas inicio. Documentar fórmula en `MetricsService`. Net churn = v2.

---

## Q-08 — Auditoría formal de sync runs

**Pregunta**: ¿Sync runs se loguean solo con `Logger` (NFR-006) o persistimos en `ext_stripe_sync_log` (history de runs con drift, errores, duración)?

**Impacto**: No bloqueante. Logger es mínimo.
**Recomendación**: v1 = Logger. Si ops pide historial, añadir tabla en v2.

---

## Q-09 — ¿Webhook events adicionales?

**Pregunta**: FR-403 deja abierto si añadir `customer.subscription.trial_will_end` (notifcar trial expirando), `payment_intent.payment_failed` (catch más granular que `invoice.payment_failed`).

**Impacto**: No bloqueante.
**Recomendación**: Añadir `trial_will_end` → email usuario "tu trial termina en 3 días" (valor claro). `payment_intent.payment_failed` redundante con `invoice.payment_failed` → no añadir.

---

## Q-10 — Componentes nuevos faltantes

**Pregunta**: ¿Hace falta algún componente base-ui adicional no cubierto por el PRD base-ui-components?

Análisis:
- **Fechas de renewals en tabla**: `DataTable` base cubre. No nuevo.
- **Timeline de eventos de billing**: ¿componente `TimelineList`? No existe en base. [NEEDS CLARIFICATION: ¿vale la pena pedirlo al PRD base, o inline ad-hoc?]
- **Diff viewer de sync drift**: ¿componente para mostrar "local dice X, Stripe dice Y"? No existe. [NEEDS CLARIFICATION]

**Impacto**: No bloqueante (pueden ser inline ad-hoc en `@stripe/components/`).
**Recomendación**: Inline ad-hoc por ahora. Si > 2 extensiones lo piden, promover a base-ui.