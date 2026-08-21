---
doc: email-system-v2/07-open-questions
title: "Open Questions"
status: draft
created: 2026-08-20
---

# Open Questions

Las open questions Q-001 a Q-008 del v1 están **RESUELTAS** por las decisiones del usuario. Las nuevas Q-009 a Q-012 se resuelven con spike técnico en Fase 0.

## Resueltas (decisiones del usuario — v1 elicitadas, v2 confirmadas)

### ✅ Q-001: Maizzle v6 como workspace `packages/emails/` — RESUELTA

**Decisión**: workspace `packages/emails/` con `"type": "module"`, deps `@maizzle/framework` + `@maizzle/tailwindcss`. Maizzle framework + shared `Layout.vue` + core templates viven aquí. `apps/back/` consume via dynamic import.

**Razón**: ESM nativo aislado del CJS de `apps/back/`. Patrón oficial Maizzle. `pnpm-workspace.yaml` ya incluye `packages/*`. Resuelve la fricción ESM/CJS del v1 (R-ESM-1 eliminado).

**Estado**: ✅ RESUELTA. Implementación en Fase 0 (FR-070).

---

### ✅ Q-002: ESM vs CJS — RESUELTA

**Decisión**: `packages/emails/` workspace ESM-native. `apps/back/` consume via dynamic `import('@maizzle/framework')` desde CJS. Node 20+ soporta dynamic import CJS→ESM.

**Razón**: el workspace aísla la fricción ESM/CJS. Si el dynamic import directo falla, `packages/emails/` expone API boundary (ver Q-009).

**Estado**: ✅ RESUELTA. Spike Fase 0 confirma el dynamic import (R-DYNAMIC-1). Resuelve R-ESM-1 del v1.

---

### ✅ Q-003: Tailwind 4 coexistencia — RESUELTA

**Decisión**: coexisten naturalmente. Frontend `apps/front/` ya tiene Tailwind 4.1.3 + DaisyUI 5.5.19 (verificado en `apps/front/package.json`: `tailwindcss ^4.1.3`, `@tailwindcss/vite ^4.1.3`, `daisyui ^5.5.19`). `@maizzle/tailwindcss` (Tailwind 4) en `packages/emails/` coexiste en workspaces separados.

**Razón**: el v1 de este PRD estaba EQUIVOCADO al decir "frontend usa Tailwind 3". Verificado: frontend usa Tailwind 4.1.3. Ambos son Tailwind 4. No hay conflicto.

**Estado**: ✅ RESUELTA. Verificación final en Fase 0 (`pnpm --filter front build` sin regresión, NFR-007). R-MAIZ-1 del v1 eliminado.

---

### ✅ Q-004 (CRÍTICA del v1): Handlebars runtime post-Maizzle v6 — RESUELTA (ELIMINACIÓN)

**Decisión**: **ELIMINAR Handlebars completamente**. Usar `render()` API de Maizzle v6 que compila `.vue` + Tailwind + inlines CSS en runtime, pasando datos dinámicos como Vue props. Cero `{{handlebars}}` runtime, cero `Handlebars.compile`, cero dependencia `handlebars`.

**Razón**: la incógnita del v1 ("¿Vue consume `{{}}`?") es irrelevante — no hay Handlebars que interpolar. `render(path, { props })` retorna `{ html, plaintext }` con todo interpolado via Vue SSR. Verificado en https://maizzle.com/docs/deploy/nodemailer.

**Estado**: ✅ RESUELTA. Esta era LA incógnita crítica bloqueante del v1. La decisión del usuario la elimina por completo. R-RENDER-2 del v1 eliminado. Implementación en Fases 1-2.

> **Nota histórica**: el v1 de este PRD trataba Q-004 como la incógnita más crítica ("si Vue consume `{{}}`, el renderer runtime debe cambiar a Vue SSR — cambio arquitectural mayor"). La decisión del usuario es ADOPTAR Vue SSR via `render()` — que era la opción (b1) del v1 — pero como solución primera, no como fallback. Esto simplifica todo: cero Handlebars, cero build step, cero `build/`.

---

### ✅ Q-005: i18n helper `{{t}}` — RESUELTA (pre-resolución)

**Decisión**: i18n se pre-resuelve en `buildEmailProps()` via `I18nService.t(key, { lang })`. Los strings traducidos se pasan como Vue props al template. Cero helper `{{t "key"}}` en templates `.vue`.

**Razón**: elimina el conflicto potencial del v1 (Vue consume `{{t "key"}}` como expresión). Los templates reciben strings planos como props (`<p>{{ greeting }}</p>` donde `greeting` ya es un string traducido). Más simple, más tipado, cero ambigüedad.

**Estado**: ✅ RESUELTA. Implementación en Fase 4 (FR-050, FR-051). R-I18N-1 del v1 eliminado.

---

### ✅ Q-006: Cache invalidation strategy — RESUELTA (path + propsHash)

**Decisión**: cache por `path + sha256(stableStringify(props))` en `TemplateRenderer`. Hit si mismo path + mismos props. Miss → `render()` → cache + return.

**Razón**: para emails transaccionales con props únicos (reset-password con hash único), el cache siempre miss en ese path+props — pero Maizzle v6 cachea internamente el SFC compilado, así que solo la interpolación de props se repite (rápido en v6). Aceptable para bajo volumen. Alternativa del v1 (mtime check) no aplica — no hay archivos `build/` cuyo mtime verificar.

**Estado**: ✅ RESUELTA. Implementación en Fase 2 (FR-020). R-CACHE-1 (v2) lo documenta como limitación aceptable.

---

### ✅ Q-007: Auto-discovery — RESUELTA (extensions + modules + packages)

**Decisión**: `EmailDiscoveryService` escanea `extensions/*/emails/*.vue` + `modules/*/emails/*.vue` + `packages/emails/emails/*.vue` por convención. **Sin** subcarpeta `templates/` — directamente `emails/`. Drop folder → funciona.

**Razón**: el usuario dijo explícitamente "quitaría el nombre de templates y sería ej: extensions/*/emails". Extensiones Y módulos core pueden tener `emails/`. Alinea con auto-discovery de extensiones del monorepo.

**Estado**: ✅ RESUELTA. Implementación en Fase 3 (FR-040, FR-043, FR-072).

---

### ✅ Q-008: `invoicePaymentConfirmed` approach — RESUELTA (opción b, migrar a dispatcher)

**Decisión**: opción (b) del v1 — migrar `invoicePaymentConfirmed` a dispatcher. **Eliminar** `MailService.invoicePaymentConfirmed()`. Stripe crea `extensions/stripe/emails/invoice.vue` y usa `NotificationDispatcher`. Stripe deja de importar `MailService` (`stripe.service.ts:8,24,601`).

**Razón**: consistencia total con el patrón unificado. Todas las extensiones via dispatcher, cero extensión importa `MailService`. El v1 recomendaba (a) "template en core" como mínimo cambio — el usuario eligió (b) para consistencia.

**Estado**: ✅ RESUELTA. Implementación en Fase 3 (FR-060, FR-061, FR-063).

---

## Nuevas open questions (spike Fase 0)

### ❓ Q-009: API boundary — ¿dynamic import directo o `packages/emails/` expone servicio?

**Pregunta**: ¿`apps/back/` hace `dynamic import('@maizzle/framework')` directo (simple), o `packages/emails/` expone un servicio compilado (API boundary) que `apps/back/` consume via dynamic import del boundary?

**Contexto**: `@maizzle/framework` v6 es ESM-first. `apps/back/` es CJS. `packages/emails/` es workspace ESM-native. Node 20+ soporta `dynamic import()` desde CJS hacia ESM, pero algunos paquetes ESM tienen issues (exports resolution, top-level await). Si el dynamic import directo funciona, es más simple (una indirection menos). Si falla, `packages/emails/` expone una API boundary: un `index.ts` compilado a `.js` ESM que wrap `render()` y expone una función tipada, que `apps/back/` consume via `dynamic import('@foundation/emails')`.

**Opciones**:
- (a) **Dynamic import directo**: `const { render } = await import('@maizzle/framework')` desde `apps/back/`. Simple, una indirection. Si funciona, es la opción preferida.
- (b) **API boundary**: `packages/emails/index.ts` exporta `export { renderEmail } from './render.js'` (wrapper tipado), `apps/back/` hace `const { renderEmail } = await import('@foundation/emails')`. Más desacoplado (apps/back no conoce `@maizzle/framework` directo), pero una indirection más.

**Impacto**: no bloqueante pero determina la estructura de consumo. R-DYNAMIC-1.

**Owner**: spike Fase 0.

**Estado**: open — spike: intentar `dynamic import('@maizzle/framework')` desde un script CJS en `apps/back/`. Si funciona → (a). Si `ERR_REQUIRE_ESM` o exports issue → (b).

---

### ❓ Q-010: `Layout.vue` reference path — ¿alias tsconfig, relativo, o absoluto?

**Pregunta**: ¿Cómo referencian los templates `.vue` al `Layout.vue` compartido en `packages/emails/emails/Layout.vue`?

**Contexto**: los templates viven en `packages/emails/emails/`, `extensions/<name>/emails/`, y `modules/<name>/emails/`. Todos necesitan importar `Layout.vue` de `packages/emails/emails/`. Tres approaches:

**Opciones**:
- (a) **Alias `@emails/Layout.vue`** en `apps/back/tsconfig.json` (paths: `@emails/*` → `../../packages/emails/emails/*`): limpio, idiomático Vue. Requiere config tsconfig. Maizzle `render()` necesita resolver el alias — verificar que lo hace (puede requerir `vite.config` o `tsconfig` paths en el resolver de Maizzle).
- (b) **Import relativo** (`import Layout from '../../../../../../packages/emails/emails/Layout.vue'`): verboso, frágil a movimientos de carpeta, pero sin config.
- (c) **Path absoluto** (`import Layout from '/home/dev/projects/foundation/packages/emails/emails/Layout.vue'`): acoplado al filesystem, no portable. Descartado.

**Impacto**: afecta todos los templates. (a) es más limpio pero requiere verificar que Maizzle `render()` resuelve el alias. R-EXT-1 (si el alias no resuelve, el template falla).

**Owner**: spike Fase 0.

**Estado**: open — recomendación tentativa: (a) alias `@emails/Layout.vue`. Spike: crear `test.vue` con `import Layout from '@emails/Layout.vue'`, llamar `render()`, verificar que resuelve. Si no resuelve, (b) relativo o configurar resolver de Maizzle.

---

### ❓ Q-011: Render performance en prod — ¿`render()` < 500ms primera vez?

**Pregunta**: ¿`render()` runtime completa el primer render (compilación Vue SFC + Tailwind inline) en menos de 500ms por email?

**Contexto**: Maizzle v6 `render()` compila el SFC on-demand. Issue #430 reportó 18s en Kubernetes con v5. v6 es más rápido (Vite-powered) pero cold start en Kubernetes puede sumar. Si el primer render > 2s, el usuario espera un email de auth con latencia perceptible. NFR-001 target: < 500ms first render, < 5ms cache hit.

**Opciones**:
- (a) **< 500ms**: aceptable, sin mitigación. Cache hit < 5ms tras primer render.
- (b) **500ms - 2s**: aceptable pero documentar. Considerar warm-up.
- (c) **> 2s**: plan de warm-up (pre-render de templates comunes en startup del backend: llamar `render()` para `activation.vue`, `reset-password.vue`, `confirm-new-email.vue` con props vacíos al arrancar, poblaciondo el cache interno de Maizzle).

**Impacto**: R-PERF-1. Determina si se necesita warm-up en startup.

**Owner**: spike Fase 0.

**Estado**: open — spike: benchmark `render('packages/emails/emails/activation-spike.vue', { props: { name: 'Juan' } })` first render y cache hit. Documentar ms.

---

### ❓ Q-012: Props serialization — ¿hay datos no serializables en el context actual?

**Pregunta**: ¿Los props que se pasan a `render()` son serializables (strings, numbers, arrays, objects plain)? ¿Hay Date objects, instancias de clases, o otros no-serializables en el context Handlebars actual?

**Contexto**: Vue props deben ser serializables para que Vue SSR los interpole. Si el context Handlebars actual pasa `Date` objects (ej: `invoice.dueDate = new Date()`), Vue no los interpola bien — hay que convertirlos a ISO string en `buildEmailProps()`. Otros casos: instancias de entidades TypeORM (objetos con methods), Maps, Sets.

**Opciones**:
- (a) **Todo serializable**: sin acción. Los props actuales son strings/numbers/objects plain.
- (b) **Date objects presentes**: convertir a ISO string en `buildEmailProps()` — `dueDate: invoice.dueDate.toISOString()`.
- (c) **Instancias de entidades TypeORM**: convertir a plain objects — `entity: { id: e.id, name: e.name, ... }` (no pasar la instancia con methods).

**Impacto**: afecta `buildEmailProps()` (FR-030). Si hay no-serializables, hay que documentar la conversión. No bloqueante.

**Owner**: spike Fase 0.

**Estado**: open — spike: inspeccionar el context Handlebars actual en `mailer.service.ts` y `notification-dispatcher.ts:425-467`, listar tipos de valores. Si hay `Date` o instancias, documentar conversión.

---

## Resumen

| ID | Tema | Estado | Bloqueante | Fase |
|----|------|--------|-----------|------|
| Q-001 | Maizzle v6 workspace | ✅ RESUELTA | — | Fase 0 implementación |
| Q-002 | ESM vs CJS dynamic import | ✅ RESUELTA | — | Fase 0 verificación |
| Q-003 | Tailwind 4 coexistencia | ✅ RESUELTA | — | Fase 0 verificación |
| Q-004 | Handlebars runtime (v1 crítica) | ✅ RESUELTA (eliminación) | — | Fases 1-2 |
| Q-005 | `{{t}}` helper | ✅ RESUELTA (pre-resolución) | — | Fase 4 |
| Q-006 | Cache invalidation | ✅ RESUELTA (path+propsHash) | — | Fase 2 |
| Q-007 | Auto-discovery | ✅ RESUELTA (3 roots) | — | Fase 3 |
| Q-008 | `invoicePaymentConfirmed` | ✅ RESUELTA (opción b) | — | Fase 3 |
| Q-009 | API boundary (dynamic import vs boundary) | open | No (spike) | Fase 0 |
| Q-010 | `Layout.vue` alias | open | No (spike) | Fase 0 |
| Q-011 | Render performance prod | open | No (spike) | Fase 0 (benchmark) |
| Q-012 | Props serialization | open | No (spike) | Fase 0 |

> **Q-009, Q-010, Q-011, Q-012 se resuelven con spike técnico en Fase 0.** Q-011 (R-PERF-1) es la más importante — si `render()` > 2s, se necesita plan de warm-up. Ninguna es bloqueante como lo era Q-004 del v1 (que ya está resuelta por eliminación de Handlebars).