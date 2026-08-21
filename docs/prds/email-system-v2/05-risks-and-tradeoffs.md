---
doc: email-system-v2/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-08-20
---

# Riesgos y Trade-offs

## Trade-offs honestos

### Doble pipeline → unificado

| Aspecto | Detalle |
|---------|---------|
| Costo | Refactor inicial de 3 render paths a 1 `TemplateRenderer` (wraps `render()`), unificación de props shape, migración de templates |
| Costo | Blast radius mayor: un bug en `TemplateRenderer` afecta TODOS los emails (R-RENDER-1) |
| Beneficio | DRY, un solo cache, un solo lugar para props shape, consistencia |
| Beneficio | Nuevos tipos de email usan el mismo camino — cero decisión de patrón |

### Handlebars runtime → `render()` runtime (eliminación Handlebars)

| Aspecto | Detalle |
|---------|---------|
| Costo | Rewriting de templates `.hbs` → `.vue` (Vue SFCs, `defineProps`, Tailwind 4 en `<style>`) |
| Costo | `render()` runtime añade Vue SSR al backend (R-VUE-RUNTIME-1), costo de CPU en primer render (R-PERF-1) |
| Beneficio | **Cero Handlebars** — deuda técnica eliminada, una sola tecnología (Vue) |
| Beneficio | **Cero build step** — `render()` lee `.vue` on-demand, no hay `build/` que commitear ni olvidar correr |
| Beneficio | Datos dinámicos como Vue props — tipado via `defineProps()`, cero `{{handlebars}}` ambigüedad |
| Beneficio | i18n pre-resuelto como props — cero helper `{{t}}` conflictivo |

### ESM workspace `packages/emails/`

| Aspecto | Detalle |
|---------|---------|
| Costo | Un workspace más (`packages/emails/`) con su `package.json` y deps |
| Costo | Path indirection para `@emails/Layout.vue` (Q-010) |
| Beneficio | ESM nativo aislado del CJS de `apps/back/` — cero fricción ESM/CJS en runtime |
| Beneficio | Layout compartido central (`packages/emails/emails/Layout.vue`) |

### Templates desde cualquier sitio (auto-discovery)

| Aspecto | Detalle |
|---------|---------|
| Costo | I/O de glob scanning en startup (D-02 trade-off) |
| Costo | Posible colisión de nombres entre `extensions/foo/emails/bar.vue` y `modules/baz/emails/bar.vue` |
| Beneficio | Drop folder `emails/*.vue` en cualquier extensión o módulo → funciona sin config |
| Beneficio | Módulos core (no solo extensiones) pueden tener emails |

### Eliminación `build/` (vs commitear build/ del v1)

| Aspecto | Detalle |
|---------|---------|
| Costo | `render()` runtime tiene costo CPU en primer render (R-PERF-1) |
| Beneficio | Cero `build/` en repo — cero bug de "fresh checkout no envía emails" |
| Beneficio | Deploy determinista sin build step de templates |
| Beneficio | Cero hooks frágiles, cero `flatten-maizzle-output.js` |

---

## Riesgos técnicos

### R-RENDER-1 — Renderer unificado blast radius

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Un bug en `TemplateRenderer` (cache corrupto, props injection roto, dynamic import leak) afecta TODOS los emails — core auth (activación, reset password) + spec-engine (tasks, affiliate, upload-post, stripe). Antes, un bug en el core no afectaba al spec-engine y viceversa. |
| Severidad | Alta |
| Probabilidad | Media |
| Mitigación | Tests de `TemplateRenderer`: cache hit/miss (mismo path+props → hit, props distintos → miss), props injection (`buildEmailProps()` produce shape correcto), dynamic import lazy-load (una sola vez), clearCache. Coverage alto. Rollback: si `TemplateRenderer` falla, se puede revertir al rendering anterior (los 3 paths duplicados) via git revert de la Fase 2. |
| Tracking | Fase 2 exit gate: tests de renderer pasan; smoke test de envío de email core + spec-engine. |

### R-EXT-1 — Extension template error aísla extensión

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Un error de sintaxis en `extensions/foo/emails/bar.vue` (Vue compile error, import roto a `@emails/Layout.vue`) hace que `render()` falle para ese template. Con auto-discovery, el `EmailDiscoveryService` lo encuentra pero `TemplateRenderer.render()` lanza. El error se propaga al caller (dispatcher), que debe manejarlo sin romper otras extensiones. |
| Severidad | Media |
| Probabilidad | Media |
| Mitigación | `NotificationDispatcher` ya tiene try/catch en `renderTemplate()` (`notification-dispatcher.ts:425-467`) — mantener el manejo de errores por-notificación. Un template roto en `tasks/emails/` NO debe impedir que `affiliate/emails/` renderice. Log claro del path que falló. Convention: import `Layout.vue` via alias `@emails/Layout.vue` (Q-010), no path hardcoded. |
| Tracking | Fase 3 exit gate: error de sintaxis en `extensions/tasks/emails/broken.vue` → render de tasks falla con log claro, PERO render de `affiliate/emails/` + `packages/emails/emails/activation.vue` siguen OK. |

### R-CACHE-1 — Cache miss para props únicos

| Aspecto | Detalle |
|---------|---------|
| Riesgo | El cache de `TemplateRenderer` (`Map<path+propsHash, html>`) siempre miss para emails con props únicos por request — ej: reset-password con hash único, activation con token único. Cada email transaccional de auth cache miss. |
| Severidad | Baja |
| Probabilidad | Alta (por diseño — los tokens son únicos) |
| Mitigación | Maizzle v6 cachea internamente el SFC compilado (Vue SFC → render function), así que solo la interpolación de props se repite, no la compilación del SFC. La interpolación de props en v6 es rápida. Aceptable para emails transaccionales de bajo volumen. Alternativa considerada: cachear el SFC compilado separadamente de la interpolación de props (complejidad extra, no necesaria si v6 es rápido). Decisión: aceptar miss para unique-props emails, medir en Fase 0 (Q-011). |
| Tracking | Fase 0 (benchmark render() con props únicos) + Fase 2 (log métrica cache hit ratio). |

### R-PERF-1 — `render()` runtime performance en primer render

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `render()` runtime compila el Vue SFC + Tailwind inline on-demand. El primer render de cada template puede ser lento. Issue #430 reportó 18s en Kubernetes con Maizzle v5. v6 es más rápido (Vite-powered) pero necesita verificación. Si el primer render > 2s, el usuario espera un email de auth con latencia perceptible. |
| Severidad | Alta |
| Probabilidad | Media (v6 es más rápido, pero Kubernetes cold start puede sumar) |
| Mitigación | (a) Cache `TemplateRenderer` — primer render paga el costo, subsiguientes cache hit < 5ms. (b) Pre-render de templates comunes en startup del backend (warm-up): llamar `render()` para `activation.vue`, `reset-password.vue`, `confirm-new-email.vue` con props vacíos al arrancar, poblaciondo el cache interno de Maizzle. (c) Benchmark en Fase 0 (Q-011) — si > 2s, adoptar warm-up. |
| Tracking | Fase 0 exit gate: benchmark `render()` first render < 500ms (NFR-001). Si > 2s, plan de warm-up documentado. |

### R-DYNAMIC-1 — Dynamic import `@maizzle/framework` desde CJS

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `apps/back/` compila a CJS. `@maizzle/framework` v6 es ESM-first. `dynamic import('@maizzle/framework')` desde CJS debería funcionar (Node soporta dynamic import desde CJS hacia ESM), pero algunos paquetes ESM tienen issues al ser importados dinámicamente desde CJS (exports resolution, top-level await, etc.). |
| Severidad | Media |
| Probabilidad | Baja (Node 20+ soporta dynamic import CJS→ESM bien) |
| Mitigación | `packages/emails/` es workspace ESM-native (`"type": "module"`) — aísla la fricción. Si dynamic import directo falla, `packages/emails/` expone una API boundary: un servicio compilado (`.js` ESM) que `apps/back/` consume via dynamic import del boundary, no del framework directo (Q-009). Spike en Fase 0. |
| Tracking | Fase 0 exit gate: `dynamic import('@maizzle/framework')` desde `apps/back/` CJS funciona, o API boundary adoptada. |

### R-MIGR-1 — Migración sustancial (4 templates core + 2 tasks + 3 patterns inline)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Volumen de migración: 4 templates core (`.hbs` → `.vue` en `packages/emails/`), 2 templates tasks (`.hbs` → `.vue` en `extensions/tasks/emails/`), 3 patrones inline a migrar (stripe `invoicePaymentConfirmed` → `extensions/stripe/emails/invoice.vue` via dispatcher, affiliate inline HTML → `.vue`, upload-post inline HTML → `.vue`), unificación de renderer + props, eliminación de Handlebars + deps legacy. Trabajo sustancial, posibilidad de drift funcional o bugs introducidos. |
| Severidad | Media |
| Probabilidad | Alta (volumen) |
| Mitigación | Migración incremental por fases (Fase 0-4). Cada fase desplegable y reversible. Tests de renderer en Fase 2. Smoke test de envío de email tras cada fase. Comparación visual de email pre/post migración para los 4 templates core. |
| Tracking | Exit gate por fase en `06-migration-phases.md`. |

### R-VUE-RUNTIME-1 — Vue runtime en backend NestJS

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `render()` usa Vue SSR para compilar los SFCs. Esto añade Vue al runtime del backend NestJS — aumenta el footprint de memory y bundle size del backend. Si el backend ya tiene Vue en deps (verificar), impacto marginal; si no, es una dep nueva en runtime. |
| Severidad | Media |
| Probabilidad | Media |
| Mitigación | `@maizzle/framework` ya incluye Vue SSR internamente (no se añade `vue` directo a `apps/back/`). El impacto es el peso de `@maizzle/framework` en runtime. Verificar bundle size y memory en Fase 0 spike. Si impacto es alto (> 50MB memory), considerar pre-render build step como fallback (pero rompe el principio "no build step"). |
| Tracking | Fase 0 exit gate: medir memory/bundle del backend con `@maizzle/framework` en runtime. |

### R-ASTRO-1 — Dependencia con PRD `astro-public` (contacto template se reescribe 2 veces)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | El PRD `astro-public` (FR-034/035) crea un template `contact-notification.hbs` en Maizzle v5. Si `astro-public` se implementa primero, ese template se escribe en v5 y luego se reescribe en v6 como `contact-notification.vue` durante esta migración (1 template, ~30 líneas). Doble trabajo para 1 template. |
| Severidad | Baja |
| Probabilidad | Media (depende del orden de implementación) |
| Mitigación | Decisión confirmada por el usuario: "el template contacto se reescribe en v6 durante esta migración. 1 template rework, ~30 lines, acceptable cost." Si `astro-public` se implementa después, el template se escribe directamente en v6 (sin rework). Documentar el orden en `06-migration-phases.md` Fase 4. |
| Tracking | Coordinación entre PRDs. Si `astro-public` Fase 1 ya merge-eó el template v5, Fase 4 de este PRD lo reescribe en v6. |

---

## Riesgos del v1 ELIMINADOS (resueltos por las decisiones del usuario)

> Estos riesgos existían en el v1 de este PRD y **ya no aplican** porque las decisiones del usuario los resolvieron:

- ~~**R-ESM-1** — Maizzle v6 ESM vs NestJS CJS incompatibilidad~~: RESUELTO por workspace `packages/emails/` ESM-native (D-01). El dynamic import desde CJS al workspace ESM es el approach adoptado.
- ~~**R-MAIZ-1** — Tailwind 4 `@maizzle/tailwindcss` coexistencia con Tailwind 3 del frontend~~: RESUELTO — el frontend ya tiene Tailwind 4.1.3 (verificado, NO Tailwind 3 como decía el v1). `@maizzle/tailwindcss` (Tailwind 4) coexiste naturalmente en workspaces separados (NFR-007).
- ~~**R-RENDER-2** — Maizzle v6 Vue SFCs consumen `{{ }}` interpolation (CRÍTICA del v1)~~: RESUELTO por eliminación de Handlebars. Con `render()` + Vue props, NO hay `{{handlebars}}` runtime — los datos dinámicos son Vue props. La incógnita del v1 ("¿Vue consume `{{}}`?") es irrelevante: no hay Handlebars que interpolar.
- ~~**R-BREAK-1** — `maizzle build` v6 output path difiere de v5~~: RESUELTO — no hay build step (D-03). Cero `build/`, cero paths que actualizar.
- ~~**R-I18N-1** — Helper `{{t}}` registro en Handlebars conflicto con Vue templating~~: RESUELTO por pre-resolución de i18n. Los strings se pre-resuelven en `buildEmailProps()` y se pasan como props. Cero helper `{{t}}` en templates (FR-050).
- ~~**R-Deps-1** — `@maizzle/framework` v6 requiere Node version compatible~~: Se mantiene verificación en Fase 0 pero no es un riesgo bloqueante — el workspace aísla y Node 20+ soporta dynamic import ESM.

---

## Matriz severidad / probabilidad

| Riesgo | Severidad | Probabilidad | Prioridad |
|--------|-----------|--------------|-----------|
| R-RENDER-1 Renderer blast radius | Alta | Media | Alta |
| R-EXT-1 Extension template error | Media | Media | Media |
| R-CACHE-1 Cache miss unique props | Baja | Alta (por diseño) | Baja |
| R-PERF-1 render() performance | Alta | Media | Alta (spike Fase 0) |
| R-DYNAMIC-1 Dynamic import CJS→ESM | Media | Baja | Media (spike Fase 0) |
| R-MIGR-1 Volumen migración | Media | Alta | Media-Alta |
| R-VUE-RUNTIME-1 Vue runtime en backend | Media | Media | Media (spike Fase 0) |
| R-ASTRO-1 Contacto template rework | Baja | Media | Baja |

## Prioridad de mitigación

1. **Alta (spike Fase 0)**: R-PERF-1 (benchmark `render()` first render < 500ms, warm-up plan si > 2s), R-RENDER-1 (renderer tests en Fase 2), R-DYNAMIC-1 (dynamic import spike Fase 0), R-VUE-RUNTIME-1 (medir memory/bundle Fase 0).
2. **Media-Alta**: R-MIGR-1 (migración incremental por fases, smoke test por fase).
3. **Media**: R-EXT-1 (try/catch por-notificación en dispatcher, log claro del path fallido).
4. **Baja**: R-CACHE-1 (aceptar miss para unique-props, Maizzle v6 cachea SFC internamente), R-ASTRO-1 (costo aceptable, decisión usuario).