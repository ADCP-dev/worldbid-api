---
doc: affiliate/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack relevante

- **Backend**: NestJS + TypeORM + PostgreSQL + `@nestjs/schedule` (Cron) + `QueuedMailerService` (Bull + Nodemailer). Config via `registerAs` + `ConfigService<AllConfigType>`.
- **Frontend**: Nuxt 3 (layer `extensions/affiliate/`) + Vue 3 `<script setup>` + TanStack Query (parcial — `useAffiliate` usa `$fetch` directo hoy) + DaisyUI + vue-sonner (toasts).
- **Auth**: JWT + `RolesGuard` + `@Roles(RoleEnum.admin | RoleEnum.affiliate)`. Roles en DB con `homeRoute`.
- **Extensiones**: `affiliate` depende de `crm` (FK a `crm_client`, `crm_project`, `crm_origin`). Si se borra crm, affiliate se salta con warning.

## Path aliases

| Alias | Destino | Uso en affiliate |
|-------|---------|-------------------|
| `@affiliate` | `apps/front/extensions/affiliate` | `@affiliate/composables/useAffiliate` |
| `@ext/affiliate/*` | `apps/back/src/extensions/affiliate/*` | `@ext/affiliate/services/...` |
| `@base/ui-app/components/` | `apps/front/modules/base/ui-app/components/` | StatCard, TrendChart, etc. (catalogados en PRD base) |
| `@crm/*` | `apps/front/extensions/crm` (front) / `apps/back/src/extensions/crm/*` (back) | FK references |

## Dependencias existentes relevantes

| Lib | Dónde | Rol |
|-----|-------|-----|
| `@nestjs/schedule` | back | `@Cron` decorator (ReportService) |
| `cron-parser` | front (propuesto en PRD base Q-001) | Validar cron + próximas ejecuciones |
| `echarts` + `vue-echarts` | front (ya instalados) | Charts via wrappers base |
| `Intl.NumberFormat` | front | Formateo de moneda EUR |
| `QueuedMailerService` | back (`@comms/email-queue`) | Envío de emails (invitación partner, reporte mensual) |

## Convenciones verificadas

- **Back**: entidades con prefijo `ext_affiliate_*`. Controllers con `@Controller({ path: 'affiliate/...', version: '1' })`. Logger NestJS (no console.log).
- **Front**: composable `useAffiliate()` con métodos `get*`/`create*`/`update*`. Tipos en `extensions/affiliate/types.ts`. Pages en `pages/app/affiliate/*` (admin) y `pages/app/portal/*` (afiliado). Middleware `['auth','admin']` para admin, `['auth']` para portal.
- **i18n**: falta `affiliate.json` en `apps/front/i18n/locales/{es,en}/` — crear como parte del DoD.

## Constraints (three-tier)

| Tier | Constraint |
|------|------------|
| ✅ Always | Usar componentes base del catálogo (StatCard, TrendChart, etc.) — no charts inline. |
| ✅ Always | `LinkedSelect` (base FR-021) para forms encadenados — no orquestar 2 FormSelect a mano. |
| ✅ Always | `CronScheduleEditor` (base FR-010) para editar cron — no input cron crudo. |
| ✅ Always | Migraciones via `pnpm migration:generate` + `pnpm migration:run` — nunca SQL a mano. |
| ✅ Always | Generadores Hygen para nuevos recursos/properties — no escribir entity/service a mano. |
| ✅ Always | Alias `@affiliate/*`, `@ext/affiliate/*`, `@base/ui-app/components/` — no relativas largas. |
| ✅ Always | RBAC: dashboard admin = `RoleEnum.admin`; portal = `RoleEnum.affiliate` (o admin). |
| ✅ Always | Logger NestJS en back; `vue-sonner` toast en front — no `console.log`. |
| ⚠️ Ask first | Añadir columna `code` a `ext_affiliate_partner` (migration + entidad) — ver Q-002. |
| ⚠️ Ask first | Mover cron a `registerAs('affiliate')` config-driven — ver Q-005. |
| ⚠️ Ask first | Definición de "MRR atribuido" — ver Q-006. |
| 🚫 Never | Exponer IBAN en listados admin (solo en detalle). |
| 🚫 Never | Calcular comisiones en frontend — siempre backend (source of truth). |
| 🚫 Never | Permitir payout automático sin validación humana — ver Q-003. |
| 🚫 Never | Hardcodear cron, emails, URLs, currencies — siempre config/env. |

## Supuestos asumidos

- **Asumido**: el PRD base `base-ui-components` se implementa primero (proporciona StatCard, LinkedSelect, CronScheduleEditor, etc.). Este PRD referencia FR-NNN de ese catálogo.
- **Asumido**: `cron-parser` y `cronstrue` se aprueban (Q-001 PRD base) — necesarios para `CronNextRunsPreview` y validación backend.
- **Asumido**: el modelo de comisión es one-time por proyecto pagado (no recurring) — ver Q-001 para revisar.
- **Asumido**: el cron del reporte se aplica al siguiente bootstrap, no en vivo (R-04 PRD base). El editor edita la config persistida.
- **Asumido**: el frontend ya tiene `useThemeColors()` y el plugin base de ECharts (DoD PRD base).
- **Asumido**: `extensions/affiliate/plugins/dashboard-widgets.ts` (inyección en CRM dashboard) se mantiene — no se toca en este PRD.
- **Asumido**: el dashboard admin actual (`AffiliateDashboard.vue`) se reescribe completamente (no se parchea) — ver `06-migration-phases.md`.