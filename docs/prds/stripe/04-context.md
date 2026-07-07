---
doc: stripe/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack actual

### Backend
- NestJS + TypeORM + PostgreSQL
- Stripe SDK (`stripe` npm) — inyectado vía `stripe.provider.ts` condicional
- Nodemailer + `MailService` (`@comms/mail`) para invoice emails
- Bull (presente en monorepo, **no usado por stripe actualmente**)
- Path alias: `@ext/stripe/*`

### Frontend
- Nuxt 3 + Vue 3 + DaisyUI + Tailwind + Pinia + TanStack Query
- `useStripe.ts` con TanStack Query keys (`stripeKeys`)
- Path alias: `@stripe` → `apps/front/extensions/stripe`
- `@base/ui-app/components/` para charts (FR-001..FR-005), scheduling (FR-010/FR-011), automation (FR-021)
- `useThemeColors()` para ECharts theming

## Convenciones del proyecto

| Convención | Regla |
|------------|-------|
| Tablas extensión | Prefijo `ext_stripe_` (ya aplicado) |
| Path alias back | `@ext/stripe/*` |
| Path alias front | `@stripe/*` |
| Entity discovery | TypeORM glob `**/*.entity{.ts,.js}` — automático |
| Module discovery | `extension.module.ts` auto-cargado por `ExtensionLoaderModule` |
| Logs | NestJS `Logger` — nunca `console.log` |
| Imports | Alias absolutos, nunca relativas largas |
| `import type` | Para tipos only |
| Migraciones | `pnpm migration:generate` + `pnpm migration:run` — nunca SQL a mano |
| Front forms | Zod + `@base/ui-app` form components |
| Front tables | `DataTable` base + TanStack Vue Table |

## Dependencias

### Internas (extensiones/módulos)
- `auth` — JWT, UsersService, RolesGuard, PlanGuard
- `storage` — declarada en manifest (uso futuro para invoices PDF storage)
- `translations` — i18n de plan names/descriptions
- `@comms/mail` — `MailService.invoicePaymentConfirmed` (ya usado)
- `@users/users.service` — `findById`, `update` (stripeCustomerId)
- `@base/ui-app/components/charts|scheduling|automation` — PRD base-ui-components

### Externas (npm)
- `stripe` — Stripe Node SDK (presente)
- `@nestjs/schedule` — [NEEDS CLARIFICATION: verificar si instalado en `apps/back/package.json`; grep no encontrado]
- `echarts` + `vue-echarts` — ya en `apps/front/package.json`
- `cron-parser` — para `CronNextRunsPreview` (dep del PRD base, añadir)
- `cronstrue` — para human-readable cron (dep del PRD base, añadir)

### APIs externas
- Stripe API (`https://api.stripe.com`) — products, prices, subscriptions, invoices, checkout, billing portal, webhooks
- Stripe CLI (dev) — `stripe listen --forward-to localhost:3001/api/v1/stripe/webhooks`

## Constraints (three-tier)

| Tier | Constraint |
|------|-----------|
| ✅ Always | Mantener auto-discovery (no tocar `app.module.ts`) |
| ✅ Always | Tabla prefix `ext_stripe_` para nuevas tablas |
| ✅ Always | Stripe SDK condicional — extensión funciona sin keys (test mode) |
| ✅ Always | Webhook raw body para signature verification |
| ✅ Always | Dinero en cents, display con `/100` |
| ✅ Always | Migraciones vía TypeORM CLI |
| ⚠️ Ask first | Añadir `@nestjs/schedule` dep si no está |
| ⚠️ Ask first | Añadir `cron-parser` / `cronstrue` deps al front |
| ⚠️ Ask first | Añadir `Bull` queue para sync job (alternativa a `@Cron`) |
| 🚫 Never | Modificar `app.module.ts` |
| 🚫 Never | Hardcodear secrets (`STRIPE_SECRET_KEY`, etc.) — siempre env vars |
| 🚫 Never | Mutar `unitAmount` desde queries de dashboard |
| 🚫 Never | Procesar webhook sin verificar `stripe-signature` |
| 🚫 Never | `console.log` — usar `Logger` |
| 🚫 Never | Rutas relativas largas — usar aliases |
| 🚫 Never | Escribir entity/service/controller a mano — usar Hygen generators |
| 🚫 Never | SQL DDL a mano — migraciones CLI |

## Supuestos asumidos

| Supuesto | Razón |
|----------|-------|
| Single Stripe account | Manifest no modela multi-account; Q-03 abierta |
| Currency EUR default | Observado en `price.entity` (`default: 'eur'`) |
| MRR = suma `unitAmount` mensual-normalizado | Definición estándar; sin meter pro-rata ni upgrades mid-cycle (Q-07) |
| Churn rate = canceladas en período / activas al inicio | Definición simple; [NEEDS CLARIFICATION: ¿net churn o gross churn? Q-07] |
| `@nestjs/schedule` no instalado | grep `@Cron`/`@Processor`/`@nestjs/schedule` en `apps/back` vacío |
| Dataset < 100k suscripciones | Asumido SaaS B2B típico; NFR-002 cubre 10k |
| Test mode se preserva | `stripe.service.ts` ya tiene `isStripeConfigured` guards en todos lados |