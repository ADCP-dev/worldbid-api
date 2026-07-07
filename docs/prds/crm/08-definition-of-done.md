---
doc: crm/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

La extensión CRM está completa cuando TODOS los siguientes criterios están verdes.

## Dashboard — refactor sobre catálogo base

- [ ] `CrmDashboard.vue` consume `StatCard` (FR-001 base) para 4 KPIs:
  - [ ] Total clientes
  - [ ] Clientes activos
  - [ ] Pipeline value (SUM projects.price WHERE status='active')
  - [ ] MRR (FR-031 endpoint)
- [ ] `CrmDashboard.vue` consume `TrendChart` (FR-002 base) con datos de `getDashboardTrends(range)`:
  - [ ] Toggle 30d / 90d
  - [ ] Empty-state si sin datos
- [ ] `CrmDashboard.vue` consume `BarChartCard` (FR-003 base, horizontal) para:
  - [ ] Pipeline por stage (con colores de `CrmStatusEntity.color`)
  - [ ] Clientes por origen
- [ ] `CrmDashboard.vue` consume `DonutChartCard` (FR-004 base) para distribución de status con `centerValue=totalClients`.
- [ ] Cero `stat` cards DaisyUI manuales, cero barras HTML `div` con `width%` manuales.
- [ ] Sección "Interacciones recientes" mantiene `<ul timeline>` DaisyUI (es contenido, no chart).
- [ ] Bloque `extensionWidgets` (cross-extensión) preservado — no romper affiliate injection.

## Forms automatizados

- [ ] `clients/new.vue` implementa auto-fill de `companyName` desde dominio de email (FR-010) vía composable `useAutoFillCompany`.
- [ ] `interactions/new.vue` (o el form de crear interacción) usa `LinkedSelect` (FR-021 base) cliente→contacto (FR-011) con `autoFill=true`.
- [ ] `projects/new.vue` usa `FormSelect` suelto para status (Q-005 resuelto — no LinkedSelect).
- [ ] `clients/[id].vue` muestra banner "Mover a Discovery" si cliente tiene ≥3 meetings en 14 días y status=lead (FR-013).

## Backend — endpoints nuevos

- [ ] `GET /crm/dashboard/trends?range=30d|90d` (FR-030) implementado, admin-only, retorna series temporales.
- [ ] `GET /crm/dashboard/mrr` (FR-031) implementado, admin-only, retorna `{current, previous, delta}`.
- [ ] `GET /crm/dashboard/conversion` (FR-032) implementado, admin-only, retorna `{leadToActive, proposedToActive}`.
- [ ] `CrmDashboardService` extendido con `getTrends(range)`, `getMrr()`, `getConversionRate()` usando `createQueryBuilder` + `GROUP BY DATE_TRUNC`.
- [ ] Si Q-007 aprobado: `PATCH /crm/clients/:id/anonymize` (FR-041) implementado.
- [ ] Si Q-004 aprobado: migración añade `ownerId` FK nullable a `ext_crm_client`.

## Scheduling (si Q-003 aprobado)

- [ ] `extension.config.ts` creado con `registerAs('crm')` — env vars `CRM_WEEKLY_REPORT_CRON`, `CRM_WEEKLY_REPORT_EMAIL`, `CRM_FOLLOWUP_CRON`, `CRM_FOLLOWUP_EMAIL`.
- [ ] `config.type.ts` + `infrastructure.module.ts` wiring (one-time).
- [ ] `CrmReportService` con `@Cron` + Bull queue + Nodemailer para weekly report.
- [ ] `pages/app/crm/settings/scheduling.vue` con `CronScheduleEditor` (FR-006 base) + `CronNextRunsPreview` (FR-013 base).
- [ ] Si NO se aprueba Q-003: omitir esta sección, documentar en PR que quedó fuera.

## i18n

- [ ] Creado `apps/front/i18n/locales/es/crm.json` con namespace `crm` cubriendo:
  - Headers de KPIs ("Total clientes", "Clientes activos", "Pipeline value", "MRR").
  - Headers de cards ("Pipeline de clientes", "Clientes por origen", "Distribución de status", "Interacciones recientes").
  - Toggle "30 días" / "90 días".
  - Empty-states ("Sin datos en el período", "Sin clientes nuevos", "Sin interacciones").
  - CTA "Mover a Discovery".
  - Labels de forms ("Cliente", "Contacto", "Empresa", "NIF", "Origen", "Estado").
  - Si Q-003: keys de scheduling ("Reporte semanal", "Recordatorios de follow-up", "Próximas ejecuciones").
- [ ] Creado `apps/front/i18n/locales/en/crm.json` con las mismas keys (valores en inglés).
- [ ] Todos los textos user-facing referencian `$t('crm.*')` — ningún string hardcodeado.

## Componentes base consumidos

- [ ] `@base/ui-app/components/charts/StatCard.vue` importado en `CrmDashboard.vue`.
- [ ] `@base/ui-app/components/charts/TrendChart.vue` importado.
- [ ] `@base/ui-app/components/charts/BarChartCard.vue` importado (≥1).
- [ ] `@base/ui-app/components/charts/DonutChartCard.vue` importado.
- [ ] `@base/ui-app/components/automation/LinkedSelect.vue` importado en `interactions/new.vue`.
- [ ] Si Q-003: `@base/ui-app/components/scheduling/CronScheduleEditor.vue` + `CronNextRunsPreview.vue` importados.
- [ ] `useThemeColors()` consumido por todos los charts (no colores hardcodeados).

## Testing

- [ ] Test unitario `CrmDashboardService.getTrends()` retorna N puntos según range.
- [ ] Test unitario `CrmDashboardService.getMrr()` calcula correctamente.
- [ ] Test e2e (Playwright) dashboard renderiza 4 StatCards, 1 TrendChart, 2 BarChartCards, 1 DonutChartCard.
- [ ] Test e2e `clients/new.vue` auto-fill de companyName funciona (escribe email → companyName se rellena).
- [ ] Test e2e `LinkedSelect` cliente→contacto (selecciona cliente → contactos cargan → autoFill si 1).
- [ ] Test e2e admin-only: usuario no-admin recibe 403 en `/crm/dashboard/trends`.
- [ ] Si Q-007: test `PATCH /crm/clients/:id/anonymize` setea PII a NULL.
- [ ] Tests usan `it("should ...")` (regla ESLint).

## Quality gates

- [ ] `pnpm lint` verdes en apps/back y apps/front.
- [ ] `pnpm check-types` verdes en apps/back y apps/front.
- [ ] `pnpm format` (Prettier) aplicado a archivos nuevos/modificados.
- [ ] Si migración: `pnpm migration:generate` + `pnpm migration:run` (NO hardcode SQL).

## Accesibilidad

- [ ] Toggle 30d/90d navegable por teclado (Tab + Enter/Space).
- [ ] `LinkedSelect` navegable por teclado.
- [ ] CTA "Mover a Discovery" navegable.
- [ ] Charts con `a11yTable` prop renderizan `<table class="sr-only">` (opt-in).

## Documentación

- [ ] `docs/extensions/crm.md` actualizado con nuevos endpoints (`/trends`, `/mrr`, `/conversion`) y features (auto-fill, LinkedSelect, scheduling si aplica).
- [ ] YAML frontmatter válido (`id`, `name`, `type: extension`, `dependencies`, `entities`).
- [ ] `pnpm docs:sync` ejecutado — `docs/ARCHITECTURE.md` regenerado sin errores.
- [ ] Si componente nuevo base-ui (`FunnelChartCard` de Q-009): PR separado al catálogo base.

## Privacy / GDPR

- [ ] Logs del backend no contienen PII (verificar `CrmDashboardService`, `CrmReportService` — solo IDs).
- [ ] Si Q-007: endpoint anonymize documentado y testado.
- [ ] Si Q-002 rechazado: confirmar que no hay llamadas a APIs externas con PII.

## Cierre

- [ ] Decisiones clave guardadas en Engram (`mem_save`):
  - Refactor dashboard sobre catálogo base (D-01).
  - Auto-fill company via composable local (D-02).
  - MRR desde CrmProjectEntity (D-04).
  - Scheduling decision (Q-003 outcome).
  - ownerId decision (Q-004 outcome).
- [ ] Commit con conventional commit (`feat(crm): ...` o `refactor(crm): ...`).
- [ ] PR creado referenciando este PRD (`docs/prds/crm/`).
- [ ] PRD base-ui-components actualizado si se añadió `FunnelChartCard` (Q-009).
- [ ] Session summary guardada en Engram (`mem_session_summary`).