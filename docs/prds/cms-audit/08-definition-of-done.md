---
doc: cms-audit/08-definition-of-done
title: "Definición de Hecho"
status: draft
created: 2026-07-07
---

# Definición de Hecho

## Criterios objetivos

### Backend

- [ ] Carpeta `apps/back/src/extensions/cms-audit/` con `extension.manifest.ts`, `extension.module.ts`, `extension.config.ts`.
- [ ] `extension.manifest.ts` declara `dependencies: { extensions: ['cms', 'auth', 'storage', 'translations'] }`.
- [ ] Entidades `ext_cms_audit_run`, `ext_cms_audit_finding`, `ext_cms_audit_run_config` con prefijo correcto.
- [ ] Migración generada con `pnpm migration:generate` (NO SQL a mano) y ejecutada con `pnpm migration:run`.
- [ ] `AuditCheckRegistry` con ≥ 10 checks implementados (Strategy pattern).
- [ ] `AuditProcessor` (BullMQ) procesa jobs async sin bloquear event loop.
- [ ] Endpoints REST: `POST /runs`, `GET /runs`, `GET /runs/:id`, `GET /runs/:id/findings`, `GET /dashboard`, `POST /runs/schedule`, `DELETE /runs/schedule/:id`.
- [ ] RBAC: guards con `cms-audit:read` y `cms-audit:run`; seed asigna a rol `admin`.
- [ ] `OnModuleInit` restaura crons persistentes al boot.
- [ ] NestJS `Logger` usado — cero `console.log`.
- [ ] `import type` para tipos; cero `any` (usar `unknown` + guards).

### Frontend

- [ ] Carpeta `apps/front/extensions/cms-audit/` con alias `@cms-audit` en `nuxt.config.ts`.
- [ ] Página `/app/cms/audit` con `AuditDashboard.vue`: `StatCard` × 4, `GaugeChartCard`, `BarChartCard`, `DonutChartCard`, `TrendChart`.
- [ ] `AuditRunForm.vue` con `LinkedSelect` (target + profile), `scope` selector, `CronScheduleEditor` + `WeekdayPicker` + `CronNextRunsPreview` (toggle recurrente).
- [ ] Auto-config de checks según `audit profile` (FR-011).
- [ ] `runs.vue` (DataTable histórico), `runs/[id].vue` (detalle findings con filtros por tipo/severidad).
- [ ] `useCmsAudit.ts` + `useCmsAuditDashboard.ts` (TanStack Query).
- [ ] Sidebar nav plugin inyecta "Auditoría CMS" bajo CMS.
- [ ] i18n `apps/front/i18n/locales/{es,en}/cms-audit.json` cubre labels de checks, severidades, dashboard, CTAs, empty-states.
- [ ] Accesibilidad: ARIA roles en cards/charts/tables; `aria-label` en GaugeChartCard y DonutChartCard.
- [ ] Responsive: stacked en mobile (`grid-cols-1`), horizontal en `md+`.
- [ ] Imports con alias `@cms-audit/*`, `@base/ui-app/*`. Cero relativas largas.

### Tests

- [ ] Backend unit tests: `audit.service.spec.ts`, `dashboard.service.spec.ts`, ≥ 4 `*.check.spec.ts`.
- [ ] Backend integration test: POST `/runs` → job procesa → GET `/runs/:id` retorna findings.
- [ ] Frontend: test de `AuditRunForm` (auto-config checks cambia con profile), `AuditDashboard` (render con data mock).
- [ ] Todos los tests siguen `it("should ...")` (regla ESLint).

### Documentación

- [ ] `docs/extensions/cms-audit.md` actualizado con YAML frontmatter válido (`id`, `name`, `type: extension`, `parent: cms`, `dependencies`).
- [ ] `pnpm docs:sync` ejecutado — `docs/ARCHITECTURE.md` regenerado sin errores.
- [ ] Strings de i18n documentados en el doc de extensión.

### Calidad

- [ ] `pnpm lint` verde (back + front).
- [ ] `pnpm check-types` verde (back + front).
- [ ] `pnpm format` ejecutado.

### Git / PR

- [ ] Commits conventional (`feat(cms-audit): ...`, `test(cms-audit): ...`).
- [ ] Sin "Co-Authored-By" ni atribución IA.
- [ ] PR creado con `gh pr create` referenciando la issue.
- [ ] Decisión guardada en Engram (`mem_save`) — `architecture/cms-audit-extension`.

### Consumo del catálogo base

- [ ] `StatCard` (FR-001 base) importado desde `@base/ui-app/components/charts/StatCard.vue`.
- [ ] `TrendChart` (FR-002 base), `BarChartCard` (FR-003), `DonutChartCard` (FR-004), `GaugeChartCard` (FR-005).
- [ ] `CronScheduleEditor` (FR-006), `WeekdayPicker` (FR-007), `CronNextRunsPreview` (FR-009).
- [ ] `LinkedSelect` (FR-011).
- [ ] Cero charts/KPIs implementados ad-hoc en `extensions/cms-audit/` — todo desde el catálogo base.