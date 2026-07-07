---
doc: base-ui-components/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# 08 — Definition of Done

## Criterios objetivos

### Componentes creados

- [ ] `apps/front/modules/base/ui-app/components/scheduling/CronScheduleEditor.vue`
- [ ] `apps/front/modules/base/ui-app/components/scheduling/types.ts`
- [ ] `apps/front/modules/base/ui-app/components/scheduling/lib/cronToHuman.ts`
- [ ] `apps/front/modules/base/ui-app/components/form/WeekdayPicker.vue`
- [ ] `apps/front/modules/base/ui-app/components/form/TimeWindowPicker.vue`
- [ ] `apps/front/modules/base/ui-app/components/form/KeyValueEditor.vue`
- [ ] `apps/front/modules/base/ui-app/components/form/ToggleGroup.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/StatCard.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/LineChart.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/BarChart.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/DonutChart.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/TimelineList.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/EmptyState.vue`
- [ ] `apps/front/modules/base/ui-app/components/dashboard/types.ts`
- [ ] `apps/front/modules/base/ui-app/components/automation/RadioCards.vue`
- [ ] `apps/front/modules/base/ui-app/components/automation/JsonSchemaEditor.vue`
- [ ] `apps/front/modules/base/ui-app/components/automation/FieldRelation.vue`
- [ ] `apps/front/modules/base/ui-app/components/automation/types.ts`

### Config

- [ ] `apps/front/modules/base/ui-app/nuxt.config.ts` registra las 3
  carpetas nuevas (`scheduling`, `dashboard`, `automation`) en el array
  `components` con `pathPrefix: true` (o `false` si Q-004 resuelve
  distinto).

### Demos

- [ ] `apps/front/modules/base/ui-app/pages/app/components/scheduling.vue`
  demuestra `CronScheduleEditor`, `WeekdayPicker`, `TimeWindowPicker`,
  `KeyValueEditor` con ejemplos representativos.
- [ ] `apps/front/modules/base/ui-app/pages/app/components/dashboard.vue`
  demuestra `StatCard` (con trend, loading, slot footer), `LineChart`,
  `BarChart`, `DonutChart`, `TimelineList`, `EmptyState` con datos
  mockeados.
- [ ] `apps/front/modules/base/ui-app/pages/app/components/automation.vue`
  demuestra `ToggleGroup`, `RadioCards`, `JsonSchemaEditor` (con schema
  Zod de ejemplo), `FieldRelation` (con endpoint mockeado).

### Tests

- [ ] Al menos 1 test Playwright por componente cubriendo render
  básico + interacción primaria (NFR-060). Mínimo 14 tests.
- [ ] Test unitario para `cronToHuman.ts` cubriendo los 4 modos +
  casos edge (cron inválido, cron avanzado no parseable, DST).
- [ ] Tests usan `it("should ...")` (regla ESLint).

### Documentación

- [ ] Cada componente documentado en su demo con tabla de props/slots
  + ejemplo de uso.
- [ ] `references/components.md` del skill `frontend` actualizado con
  los 14 componentes nuevos (regenerar via
  `node bin/generate-ui-components-list.js`).
- [ ] Cada `types.ts` exporta interfaces con JSDoc breve por tipo.

### Calidad

- [ ] `pnpm lint` pasa en `apps/front` (eslint --fix + prettier).
- [ ] `pnpm check-types` pasa en `apps/front` (NFR-050, NFR-051,
  NFR-052).
- [ ] Sin `any` nuevo en el codebase (regla TS guidelines).
- [ ] Sin `console.log` nuevo (regla TS guidelines).
- [ ] Sin rutas relativas largas (`../../../`) en componentes nuevos
  (regla TS guidelines).

### Validación con extensiones

- [ ] Al menos 1 extensión consume cada componente (matriz en
  `02-architecture.md`). Validación real: PR de la extensión referenciando
  el componente mergeado o en revisión.
- [ ] El dashboard de al menos 3 extensiones ya no tiene `stat` DaisyUI
  inline reemplazado por `StatCard`.
- [ ] Al menos 1 extensión con scheduling usa `CronScheduleEditor` en
  su form de config (autonomous-agent优先).

### Open questions resueltas

- [ ] Q-003 (timezone handling) resuelto antes de implementar
  `CronScheduleEditor`. Bloqueante.
- [ ] Q-004 (pathPrefix) resuelto antes de crear las carpetas.
- [ ] Q-008 (JsonSchemaEditor subset) documentado en la demo.

### Memoria persistente

- [ ] `engram_mem_save` al finalizar con resumen de decisiones (D-01
  a D-04, Q-003 resolución, catálogo de 14 componentes).

## Fuera de scope (no bloquea DoD)

- Migrar `analytics` a los nuevos wrappers (ya funciona inline).
- Migrar todos los dashboards de extensiones — cada PRD de extensión
  decide su ritmo.
- Crear componentes adicionales (Modal, Tabs, Breadcrumb, etc.)
  catalogados en R-07 — PRD separado.
- Sistema de widgets inyectables composible (propuesta
  `docs/DECOUPLING.md` sección 15) — PRD separado.
- Porteo de `cronToHuman.ts` a backend (Q-006) — tarea backend aparte.

## Cómo verificar

```bash
# Calidad
pnpm --filter front lint
pnpm --filter front check-types

# Demos ejecutan sin error en dev
pnpm dev --filter front
# visitar /app/components/scheduling, /dashboard, /automation

# Tests
pnpm --filter front test:e2e -- --grep "base-ui"
```