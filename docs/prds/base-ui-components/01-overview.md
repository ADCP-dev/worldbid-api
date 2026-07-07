---
doc: base-ui-components/01-overview
title: "Overview — Por qué necesitamos componentes base nuevos"
status: draft
created: 2026-07-07
---

# 01 — Overview

## Resumen ejecutivo

Foundation Mono tiene 7 extensiones backend y 9 carpetas frontend en
`apps/front/extensions/`. Cada extensión construye su dashboard y sus forms
desde cero, repitiendo manualmente `stat` cards de DaisyUI, tablas HTML y
cron inputs crudos (`FormInput` con regex Zod para syntax `0 9 * * 1-5`). No
existen wrappers de charts en `@base/ui-app` — solo la extensión `analytics`
usa `echarts` inline. El resultado: dashboards no-componibles, scheduling
ilegible, y forms que no se automatizan.

Este PRD define un catálogo de **14 componentes base nuevos** para
`@base/ui-app/` que las extensiones consumirán. Tres categorías: scheduling
(4), dashboard widgets (6) y automation forms (4).

## Problema

### Dashboards informativos inexistentes

Hoy cada extensión repite el patrón `stat` DaisyUI inline en su
`{Name}Dashboard.vue`:
- `apps/front/extensions/affiliate/components/AffiliateDashboard.vue`
- `apps/front/extensions/crm/components/CrmDashboard.vue`
- `apps/front/extensions/stripe/components/StripeDashboard.vue`
- `apps/front/extensions/upload-post/components/UploadPostDashboard.vue`
- `apps/front/extensions/autonomous-agent/components/AutonomousAgentDashboard.vue`
- `apps/front/extensions/cms/components/CmsDashboard.vue`
- `apps/front/extensions/content-pipeline/components/ContentPipelineDashboard.vue`

**Cero charts** en 7 de 8 dashboards. Solo `analytics` tiene charts
(`vue-echarts` inline, sin wrapper reutilizable). No existe `StatCard`
base ni `EmptyState` para listas vacías. El CRM usa `timeline` DaisyUI
inline en su dashboard.

### Scheduling ilegible

`autonomous-agent` expone 4 cron expressions editables desde UI
(`apps/front/extensions/autonomous-agent/pages/app/autonomous-agent/configs/create.vue`)
usando `FormInput` crudo + regex Zod. El usuario escribe `0 9 * * 1-5` a
mano. No hay selector de días de la semana, no hay preview
human-readable.

Otras extensiones tienen crons hardcoded sin UI:
- `affiliate` — `@Cron('0 23 28-31 * *')` en `affiliate-report.service.ts`
- `upload-post` — 4 crons en `analytics.service.ts`, `weekly-report.service.ts`, `monthly-analytics.service.ts`
- `storage` — `CronExpression.EVERY_DAY_AT_3AM`

El usuario no puede configurar horarios sin aprender cron syntax.

### Forms manuales cuando podrían automatizarse

`content-pipeline` guarda configs como JSONB opaco
(`affiliateConfig`, `socialConfig`, `cmsConfig`, `authorPersona`) sin
editor estructurado. `FieldRelation` no existe: cuando un usuario
selecciona un partner en affiliate, el cliente referido no se auto-fill
desde contexto. `ToggleGroup` y `RadioCards` no existen — los usuarios
eligen plataformas (`upload-post`) o content types (`content-pipeline`)
con `FormMultipleSelect` funcional pero visualmente plano.

## Objetivos

1. **Catálogo de 14 componentes** creados en `@base/ui-app/components/`
   siguiendo la convención existente (carpetas por categoría + `types.ts`
   + `pathPrefix` configurado en `nuxt.config.ts`).
2. **Cada componente consumido por al menos 1 extensión** (validación real
   en SDD-apply de cada PRD de extensión).
3. **CronScheduleEditor produce human-readable preview** del schedule
   ("Cada lunes a las 09:00", "Días 28-31 del mes a las 23:00").
4. **Dashboards componibles**: cada extensión arma su dashboard con
   `StatCard` + `LineChart`/`BarChart`/`DonutChart` + `TimelineList` sin
   repetir markup DaisyUI.
5. **Forms automatizados**: `FieldRelation` permite que un campo
   auto-fill otro desde endpoint/contexto sin código manual por form.

## No-objetivos

- Implementar los componentes (eso es `sdd-apply`, no PRD).
- Implementar las extensiones ni reescribir sus dashboards (cada
  extensión tiene su propio PRD que referencia este catálogo).
- Añadir nuevas dependencias npm a `apps/front/package.json` salvo
  `[NEEDS CLARIFICATION]` resuelto en `07-open-questions.md` (Q-001).
- Migrar `analytics` de `echarts` a otra lib (ya usa echarts; los nuevos
  wrappers la envuelven).
- Crear sistema de widgets inyectables composible (propuesta de
  `docs/DECOUPLING.md` sección 15 — fuera de scope, PRD separado).

## KPIs

| KPI | Meta |
|-----|------|
| Componentes creados en `@base/ui-app/components/` | 14 |
| Extensiones que consumen al menos 1 componente nuevo | 8/8 |
| Dashboards que dejan de repetir `stat` inline | 7/7 |
| Forms de scheduling con human-readable preview | 3 (autonomous-agent, upload-post, affiliate) |
| Líneas de markup DaisyUI eliminadas por extensión | ≥40 |
| Cobertura de tests por componente | ≥1 test de render (Playwright) |
| Documentación de props/slots por componente | 100% |