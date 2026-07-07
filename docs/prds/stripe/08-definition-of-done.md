---
doc: stripe/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

## Por fase (gate de merge)

### Fase 1 — Webhook idempotency
- [ ] `WebhookEventEntity` creada con `@Entity('ext_stripe_webhook_event')`.
- [ ] Migración generada con `pnpm migration:generate AddStripeWebhookEvent` y aplicada con `pnpm migration:run`.
- [ ] `stripe.service.handleWebhookEvent` chequea idempotencia antes de dispatch.
- [ ] Test unit: mismo `event.id` 2x → 1 state change.
- [ ] Test unit: `status=failed` se reprocesa.
- [ ] `pnpm lint` (apps/back) pasa sin errores nuevos.
- [ ] `pnpm check-types` pasa.
- [ ] No `console.log` (Logger).
- [ ] No nuevas rutas relativas largas (aliases `@ext/stripe/*`).

### Fase 2 — Dashboard backend metrics
- [ ] `MetricsService` + `MetricsController` creados.
- [ ] Rutas `/stripe/metrics/*` añadidas a `extension.manifest.ts`.
- [ ] Índices DB vía migración CLI (no SQL a mano).
- [ ] RBAC: `@Roles(RoleEnum.admin)` en todos los endpoints.
- [ ] Test: `metrics.service.spec.ts` cubre overview, mrr-trend, churn.
- [ ] Performance: `GET /overview` < 500ms con 10k subs (test perf o bench manual).
- [ ] `pnpm lint` + `pnpm check-types` apps/back pasa.

### Fase 3 — Dashboard frontend
- [ ] `@stripe/pages/app/stripe/metrics.vue` creada.
- [ ] Usa componentes `@base/ui-app/components/charts/` (StatCard, TrendChart, BarChartCard, DonutChartCard, GaugeChartCard). NUNCA custom.
- [ ] `useStripeMetricsQuery` añadida a `@stripe/composables/useStripe.ts`.
- [ ] i18n keys `stripe.*` en `apps/front/i18n/locales/es.json` y `en.json`.
- [ ] Responsive mobile (grid `grid-cols-1 md:grid-cols-*`).
- [ ] Theme dark/light via `useThemeColors()`.
- [ ] `pnpm lint` + `pnpm check-types` apps/front pasa.

### Fase 4 — Plan form automatizado
- [ ] `CreatePlanDto` extendido con `autoGeneratePrice` + price fields.
- [ ] `PlansService.create` implementa auto-gen con rollback best-effort.
- [ ] `PlanFormV2.vue` usa `LinkedSelect` (FR-021) + `@base/ui-app` form components.
- [ ] Test: auto-gen crea price en Stripe + plan local enlazado.
- [ ] Test: auto-gen con Stripe fail → 502, sin writes locales.
- [ ] Test: flujo sin auto-gen sin regresión.
- [ ] `pnpm lint` + `pnpm check-types` pasa.

### Fase 5 — Sync & reconciliation
- [ ] `SyncConfigEntity` (`ext_stripe_sync_config`) + migración CLI.
- [ ] `SyncService.runReconciliation()` implementado.
- [ ] `SyncSchedulerService` con `@Cron` dinámico desde config.
- [ ] `SyncController` con `POST /sync/run`, `GET/PATCH /sync/config`.
- [ ] `SyncConfigPanel.vue` con `CronScheduleEditor` + `WeekdayPicker` + `FormSwitch`.
- [ ] Test: sync detecta drift y corrige.
- [ ] Test: 409 si sync ya corriendo.
- [ ] `@nestjs/schedule` dep añadida (si no estaba).
- [ ] `pnpm lint` + `pnpm check-types` pasa.

## Globales (todas las fases)

- [ ] Commits con conventional commits (`feat(stripe):`, `fix(stripe):`, `docs(stripe):`).
- [ ] Sin `Co-Authored-By` ni atribución IA.
- [ ] No se modificó `app.module.ts`.
- [ ] No se tocaron archivos fuera de scope (ver TypeScript guidelines §11.8).
- [ ] `docs/extensions/stripe.md` actualizado con nuevas entities/rutas.
- [ ] `pnpm docs:sync` ejecutado — `docs/ARCHITECTURE.md` regenerado sin errores YAML.
- [ ] Branch + PR creado (con `gh pr create`).
- [ ] Decisiones clave guardadas en Engram (`mem_save`) — idempotency, sync config, auto-gen rollback.

## Gates de no-merge

Cualquiera de estos bloquea merge:

- ❌ Webhook sin verificar signature.
- ❌ Dinero hardcodeado o mutado desde query.
- ❌ Componente custom cuando existe base-ui equivalente.
- ❌ Migración SQL escrita a mano.
- ❌ `app.module.ts` modificado.
- ❌ `console.log` introducido.
- ❌ Secret en código.
- ❌ Ruta relativa larga (`../../../`).
- ❌ Test de idempotency no pasa (Fase 1).