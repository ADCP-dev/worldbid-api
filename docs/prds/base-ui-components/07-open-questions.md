---
doc: base-ui-components/07-open-questions
title: "Open Questions"
status: draft
created: 2026-07-07
---

# 07 — Open Questions

## Preguntas que bloquean implementación

### Q-001: ¿Lib de charts: echarts wrapper o custom SVG? [NO BLOQUEANTE]

**Contexto**: D-01 recomienda wrapper echarts porque ya está en
`package.json`. Pero para charts simples (donut 3 slices, bar 5
categorías) custom SVG sería más liviano.

**Impacto**: no bloquea — ambos caminos producen el mismo API. Solo
cambia internals.

**Recomendación**: wrapper echarts. Mantiene consistencia con la
extensión `analytics` existente y aprovecha tooltips/zoom sin
reinventar. Custom SVG solo si Q-001 se reabre tras medir bundle real.

### Q-002: ¿CronScheduleEditor soporta cron crudo para power users? [NO BLOQUEANTE]

**Contexto**: FR-005 incluye toggle "modo avanzado" con `FormInput`
crudo. ¿Lo dejamos o lo quitamos para forzar UI visual?

**Impacto**: si se quita, casos como `0 9 1-15 * 1-5` no se pueden
configurar sin componente custom. FR-006 auto-activa modo avanzado
cuando el cron entrante no encaja en ningún modo simple — sin el
toggle, esos crons no se pueden editar.

**Recomendación**: dejarlo. Es el escape hatch (T-02).

### Q-003: ¿Timezone handling en scheduling? [BLOQUEANTE]

**Contexto**: FR-008 introduce `timezone: 'user' | 'server'`. ¿El
componente emite cron en UTC, en tz del user, o emite tz aparte? ¿Backend
`@Cron` recibe UTC siempre?

**Opciones**:
- A) Componente emite cron en UTC (convierte antes de emitir). Backend
  transparente.
- B) Componente emite cron en tz elegida + campo `timezone` aparte.
  Backend debe soportar tz por config.
- C) Componente no convierte — emite en tz del user y backend asume UTC
  (现状 actual, roto en DST).

**Impacto**: bloquea implementación de `CronScheduleEditor`. Sin
decisión, no se puede saber qué string emite.

**Recomendación**: opción B — emite `{ cron: string; timezone: string }`
(v-model a objeto en vez de string). Backend debe guardar tz aparte y
convertir en runtime. Requiere cambios en `AaConfigEntity` y
config types — impacta PRD de `autonomous-agent`. Marcar como
breaking change menor.

### Q-004: ¿`pathPrefix: true` o `false` para las 3 carpetas nuevas? [NO BLOQUEANTE]

**Contexto**: `02-architecture.md` propone `pathPrefix: true` (estilo
`data-table` → `<BaseDashboardStatCard>`) para evitar colisiones de
nombres. La carpeta `form/` usa `pathPrefix: false` → `<FormInput>`.

**Opciones**:
- A) `pathPrefix: true` para las 3 nuevas → nombres namespaced
  (`<BaseDashboardStatCard>`, `<BaseSchedulingCronScheduleEditor>`).
- B) `pathPrefix: false` → nombres sueltos (`<StatCard>`,
  `<CronScheduleEditor>`). Riesgo de colisión si una extensión crea su
  propio `StatCard`.

**Impacto**: no bloquea implementación pero define el API de imports.
Cambiar después rompe todos los consumers.

**Recomendación**: A — `pathPrefix: true`. Más verboso pero seguro.

### Q-005: ¿Charts con `altText`/`fallback` por accesibilidad? [NO BLOQUEANTE]

**Contexto**: R-05 — echarts no es totalmente accesible. ¿Añadir
props `altText?: string` (descripción textual para screen readers) y
slot `fallback` (tabla HTML alternativa)?

**Impacto**: no bloquea, pero NFR-010 queda incompleto para charts si no
se decide.

**Recomendación**: añadir `altText` obligatorio a `LineChart`,
`BarChart`, `DonutChart` (prop `string`, no slot). Slot `fallback`
opcional con tabla HTML. Actualizar FR-051/061/071 en revisión.

### Q-006: ¿`cronToHuman.ts` se porta a backend? [NO BLOQUEANTE]

**Contexto**: T-04 propone util separado. ¿Lo compartimos backend
para que NestJS valide preview server-side (ej. devolver `humanReadable`
junto al `cron` en responses de config)?

**Impacto**: no bloquea — el componente funciona standalone. Pero si se
quiere preview consistente en listados backend, hay que compartir.

**Recomendación**: sí. Mover a `packages/shared/` (si existe) o
duplicar como util en `apps/back/src/...`. [NEEDS CLARIFICATION] — no
hay `packages/` visible en el reporte explore. Investigar estructura
monorepo para shared code.

### Q-007: ¿`FieldRelation` usa `useApi()` o fetch directo? [NO BLOQUEANTE]

**Contexto**: FR-130 dice "dispara fetch al `endpoint`". ¿Usa el
composable `useApi()` del proyecto (con refresh 401) o `fetch` directo
con token manual?

**Impacto**: si usa `fetch` directo, no maneja 401 ni refresh —
rompe en sesiones expiradas.

**Recomendación**: `useApi()` obligatorio. Consistente con
`docs/FRONTEND-LAYERS.md`.

### Q-008: ¿`JsonSchemaEditor` soporta schemas Zod importados dinámicamente? [NO BLOQUEANTE]

**Contexto**: FR-120 toma `schema: ZodSchema` como prop. Algunos
schemas de `content-pipeline` (`CreateCpProjectDto`) son complejos con
anidados y arrays. ¿El componente renderiza cualquier schema Zod o
solo un subset soportado (`z.object`, `z.string`, `z.number`,
`z.boolean`, `z.array(z.object())`, `z.enum`)?

**Impacto**: si se soporta cualquier schema, la implementación es
mucho más compleja. Si es subset, hay que documentar qué no soporta.

**Recomendación**: subset documentado. Soportar: `z.object`, `z.string`,
`z.number`, `z.boolean`, `z.array(z.object())`, `z.enum`, `z.optional`,
`z.nullable`. No soportar (v1): `z.discriminatedUnion`, `z.intersection`,
`z.transform`, `z.preprocess`, `z.refine` con efectos. Documentar
límites en demo.

### Q-009: ¿`TimelineList` reemplaza el timeline inline del CRM? [NO BLOQUEANTE]

**Contexto**: `apps/front/extensions/crm/components/CrmDashboard.vue`
usa `timeline` DaisyUI inline. ¿Este PRD obliga migrar CRM a
`TimelineList` o lo deja opcional?

**Impacto**: obligar = trabajo extra en PRD de crm. Opcional = doble
patrón convive.

**Recomendación**: opcional en v1. `TimelineList` se ofrece como base
nueva; CRM migra en su PRD si lo decide. DoD no exige migración
retroactiva.

## Resumen

| Q | Impacto | Recomendación |
|---|---------|---------------|
| Q-001 | no bloqueante | wrapper echarts |
| Q-002 | no bloqueante | dejar modo avanzado |
| Q-003 | **bloqueante** | opción B (cron + tz aparte) |
| Q-004 | no bloqueante | `pathPrefix: true` |
| Q-005 | no bloqueante | añadir `altText` obligatorio |
| Q-006 | no bloqueante | portear a backend (investigar packages/) |
| Q-007 | no bloqueante | `useApi()` obligatorio |
| Q-008 | no bloqueante | subset documentado |
| Q-009 | no bloqueante | opcional en v1 |