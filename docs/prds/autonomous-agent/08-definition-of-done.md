---
doc: autonomous-agent/08-definition-of-done
title: "Autonomous Agent — Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

## Tests

### Backend
- [ ] `AgentRunService.getStats()` — test unitario con datos mock (runs completados, fallidos, tokens).
- [ ] `AgentConfigService.getStats(id)` — test unitario con config activa, pausada, sin runs.
- [ ] `GET /v1/autonomous-agent/runs/stats` — test e2e (admin 200, no-admin 403, shape correcto).
- [ ] `GET /v1/autonomous-agent/configs/:id/stats` — test e2e (nextRun calculado, pausado null).
- [ ] Agregación SQL de tokens — test con `output` vacío, con tokens, con jsonb malformado (no crashea).

### Frontend
- [ ] `index.vue` — test Vitest: render 8 StatCard, charts con data vacía y con data.
- [ ] `create.vue` — test Vitest: CronScheduleEditor render, template auto-fill, CronNextRunsPreview.
- [ ] `[id].vue` — test Vitest: last run / next run, costo StatCard, modal autoApproveDrafts.
- [ ] `AutonomousAgentDashboard.vue` — test Vitest: widget render 3 StatCard.
- [ ] Test e2e Playwright: crear config con template `daily` → ver preview → guardar → ver en dashboard → ver next run.

### Cobertura
- [ ] Cobertura frontend ≥ 80% (Vitest + c8).
- [ ] Cobertura backend nuevos endpoints ≥ 90%.

## Lint y type-check

- [ ] `pnpm lint` pasa sin errores.
- [ ] `pnpm check-types` pasa (back + front).
- [ ] `pnpm format` aplicado (prettier).

## i18n

- [ ] `apps/front/i18n/locales/es/autonomous-agent.json` creado con todos los strings.
- [ ] `apps/front/i18n/locales/en/autonomous-agent.json` creado (mirror).
- [ ] No hay strings hardcoded en `.vue` (verificado con grep de literales en español/inglés fuera de `t()`).

## Documentación

- [ ] `docs/extensions/autonomous-agent.md` actualizado con:
  - Nuevos endpoints `GET /runs/stats` y `GET /configs/:id/stats`.
  - Nuevos componentes frontend consumidos (charts, scheduling).
  - Sección "Costo tokens" explicando agregación.
- [ ] YAML frontmatter válido en el `.md`.
- [ ] `pnpm docs:sync` ejecutado sin errores.
- [ ] `docs/ARCHITECTURE.md` regenerado (auto).

## Componentes base consumidos

- [ ] StatCard (FR-001) — usado en `index.vue` y `[id].vue`.
- [ ] TrendChart (FR-002) — usado en `index.vue`.
- [ ] BarChartCard (FR-003) — usado en `index.vue`.
- [ ] DonutChartCard (FR-004) — usado en `index.vue`.
- [ ] GaugeChartCard (FR-005) — usado en `index.vue` y `[id].vue`.
- [ ] CronScheduleEditor (FR-010) — usado en `create.vue` y `[id].vue` (x4 por archivo).
- [ ] WeekdayPicker (FR-011) — integrado en CronScheduleEditor weekly mode.
- [ ] CronNextRunsPreview (FR-013) — usado en `create.vue` y `[id].vue` (x4 por archivo).
- [ ] LinkedSelect (FR-021) — [PENDIENTE Q-005] o 2 FormSelect independientes.

## Git

- [ ] Branch `feat/autonomous-agent-prd` (o la que decida el workflow SDD).
- [ ] Commits con conventional commits (`feat:`, `fix:`, `docs:`, `test:`).
- [ ] Sin `Co-Authored-By` ni atribución IA.
- [ ] Referencia al issue/PRD en el commit body.
- [ ] PR creado con `gh pr create` describiendo fases completadas.
- [ ] DoD checklist pegado en la descripción del PR.

## Engram memory

- [ ] `mem_save` con decisiones clave (D-01 a D-05, templates en frontend, agregación SQL).
- [ ] `mem_session_summary` al cerrar la sesión de implementación.

## Gates finales

- [ ] Tests pasan en CI (`pnpm test`).
- [ ] Lint pasa en CI (`pnpm lint`).
- [ ] Type-check pasa en CI (`pnpm check-types`).
- [ ] Build de frontend no rompe (`pnpm build --filter front` — solo verificación, no required en dev).
- [ ] PR approved por reviewer.
- [ ] Merge a main.

## Out of scope (explicit)

- Approval flow humano (Q-006) — otro PRD.
- Multi-tenant (Q-007) — nivel plataforma.
- Tipos de agente nuevos (Q-008) — otro PRD.
- Telegram notifications reales — otro PRD.
- Costo en USD (Q-011) — con stripe/billing.
- Migración a TanStack Query (Q-001) — [PENDIENTE, puede entrar en este PRD o no].