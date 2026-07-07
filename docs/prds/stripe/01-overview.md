---
doc: stripe/01-overview
title: "Overview"
status: draft
created: 2026-07-07
---

# Overview

## Resumen ejecutivo

La extensión Stripe Billing ya existe y opera end-to-end (products, prices, plans, subscriptions, webhooks, invoices, checkout, customer portal, test mode). Faltan **visibilidad** (dashboards de métricas de billing), **automatización** (creación de planes que auto-generen prices en Stripe sin doble input manual) y **scheduling** (sync periódica y reconciliación configurable). Este PRD cubre esos tres huecos sobre la base existente.

## Problema / motivación

1. **Ops ciegas**: no hay dashboard de MRR/ARR/churn/fallos. El admin descubre problemas de billing reactivamente (queja de usuario, mail de Stripe).
2. **Doble carga manual**: crear un plan requiere crear primero el product+price en Stripe Dashboard, copiar IDs, y después crear el plan local enlazando `priceId`. Propenso a errores y desync.
3. **Sin reconciliación**: si un webhook se pierde (Stripe retry, downtime backend), la suscripción local queda desactualizada indefinidamente. No hay cronjob que sincronice.

## Objetivos

- **O-01 — Dashboards**: proveer dashboard admin con KPIs de billing (MRR, ARR, churn, suscripciones activas/trials, próximos renewals, fallos de pago, revenue por plan) usando componentes `@base/ui-app/components/charts/`.
- **O-02 — Form automatizado**: al crear/editar plan, auto-generar price en Stripe desde el form y enlazar `priceId` automáticamente. Eliminar doble input manual.
- **O-03 — Sync & reconcile**: cronjob configurable (admin UI) que sincronice subscriptions/products desde Stripe y reconcilie estado local vs Stripe.
- **O-04 — Webhooks robustos**: idempotencia garantizada para webhooks (reprocesar evento = no-op).

### Criterios de éxito medibles

- Dashboard carga < 1s con dataset de 10k suscripciones.
- Crear un plan nuevo requiere **1** submit, no 3 pantallas.
- Cronjob de reconciliación detecta drift > 0 eventos en 30 días corridos.
- Webhook duplicado (mismo `event.id`) procesado N veces = 1 write en DB.

## No-objetivos

- **NO** soporte multi-cuenta Stripe (ver Q-03).
- **NO** tax/VAT automation (ver Q-04) — se respeta lo que Stripe calcule.
- **NO** embed del Customer Portal en iframe (ver Q-05) — se usa redirect.
- **NO** refactor del modelo de datos OneToOne existente (Product↔Price↔Plan).
- **NO** billing metered avanzado (usage-based) — se mantiene el actual simple.
- **NO** Stripe Tax, Stripe Connect, Stripe Identity.

## KPIs

| KPI | Target | Medición |
|-----|--------|----------|
| Time-to-detect billing issue | < 5 min | Webhook → dashboard refresh |
| Plan creation time (admin) | < 30s | 1 form submit vs flujo actual multi-pantalla |
| Webhook idempotency | 100% | Duplicated event.id = no-op |
| Reconciliation drift | 0 | Cronjob diff local vs Stripe |
| Dashboard TTI | < 1s | 10k subscriptions dataset |