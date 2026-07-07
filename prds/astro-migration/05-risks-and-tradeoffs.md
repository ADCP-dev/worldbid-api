---
doc: astro-migration/05-risks-and-tradeoffs
title: "Riesgos y Trade-offs"
status: draft
created: 2026-07-07
---

# Riesgos y Trade-offs

## Trade-offs honestos

### Doble deploy

| Aspecto | Detalle |
|---------|---------|
| Costo | 2 pipelines (Astro CDN + Nuxt Node) + NestJS si separa |
| Complejidad ops | Más moving parts, monitoreo múltiple |
| Beneficio | Aislamiento de fallos, deploy independiente, rollback granular |

### Doble codebase

| Aspecto | Detalle |
|---------|---------|
| Costo | Mantener 2 apps frontend (Astro + Nuxt) |
| Costo | Componentes landing reescritos (no port directo Vue→Astro) |
| Beneficio | Tools óptimas para cada naturaleza (contenido vs app) |

### Curva Astro

| Aspecto | Detalle |
|---------|---------|
| Costo | Equipo aprende Astro (islands, build-time fetch API) |
| Costo | i18n Astro menos maduro que `@nuxtjs/i18n` |
| Beneficio | Simplicidad estático, performance, DX content |

### i18n limitado en Astro

| Aspecto | Detalle |
|---------|---------|
| Estado | `astro:i18n` nativo, menos features que `@nuxtjs/i18n` |
| Costo | Strings UI estáticos (no runtime DB fetch como Nuxt) |
| Mitigación | Build-time fetch si necesario, fallback estático es/en |

---

## Riesgos técnicos

### R1 — Auth `localStorage` en admin (XSS)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | JWT en `localStorage` vulnerable a XSS. Attacker con XSS roba token. |
| Severidad | Media (admin interno, no público) |
| Mitigación | Migrar a **cookies httpOnly** seteadas por NestJS. Refresh vía middleware server. |
| Estado | **Recomendado, no bloqueante** para migración Astro. Paralelo o después. |
| Tracking | Q-004 (¿cuándo migrar?) |

### R2 — Consistencia visual entre apps

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Astro y Nuxt se ven distintos (tokens drift, componentes distintos) |
| Severidad | Media |
| Mitigación | `packages/ui/` como fuente de verdad tokens. Tailwind preset + DaisyUI theme compartidos. |
| Tracking | Review gate: cambios UI deben updatear `packages/ui`. |

### R3 — Build acoplado a backend (i18n / content fetch)

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Astro build falla si NestJS no disponible (Modo B i18n o fetch API pages) |
| Severidad | Alta |
| Mitigación | Fallback graceful: si fetch falla, build con estático es/en + sin pages CMS. Webhook retry. |
| Tracking | CI debe tolerar backend down en build. NFR-007. |

### R4 — Contenido CMS stale

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Edita page en admin → sitio público stale hasta rebuild |
| Severidad | Media |
| Mitigación | Webhook NestJS → CI rebuild Astro. Cron fallback. On-demand ISR si hosting soporta. |
| Tracking | Webhook debe ser confiable + monitor (FR-021). |

### R5 — Deuda técnica landing actual

| Aspecto | Detalle |
|---------|---------|
| Riesgo | `modules/landing/` actual (16 componentes Vue) se **reescribe** en Astro (no port). Posible drift funcional. |
| Severidad | Media |
| Mitigación | Fase 1 incluye smoke test visual (Astro vs Nuxt). Checklist paridad. |
| Tracking | Lighthouse + visual diff en staging. |

### R6 — Referencias residuales post-limpieza

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Tras Fase 4, código referencia `@landing` o rutas removed → build Nuxt rompe |
| Severidad | Baja |
| Mitigación | Grep `@landing`, `/blog/`, `/page/` antes de cleanup. Typecheck. |
| Tracking | CI typecheck gate. |

### R7 — Conflictos versiones Tailwind/DaisyUI

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Astro y Nuxt usan Tailwind/DaisyUI. Versiones distintas → tokens se renderizan distinto |
| Severidad | Media |
| Mitigación | Fijar versiones compatibles en `packages/ui` peer deps. Lockfile compartido en workspace. |
| Tracking | Lockfile workspace. |

### R8 — Webhook CMS no dispara rebuild

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Admin publica page, webhook no fire, sitio stale indefinidamente |
| Severidad | Media |
| Mitigación | Cron fallback (build cada N horas). Dashboard admin muestra "último deploy". |
| Tracking | Monitor webhook + último deploy timestamp. |

### R9 — Carrito island ecommerce con estado complejo

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Carrito Vue dentro de Astro → SPA-like, complica DX |
| Severidad | Baja (Fase 3, futuro) |
| Mitigación | Mantener carrito simple (localStorage, sin sync servidor hasta checkout). |
| Tracking | Decidir en Fase 3. |

### R10 — SEO regression en migración

| Aspecto | Detalle |
|---------|---------|
| Riesgo | Migración cambia URLs / estructura → pierde ranking |
| Severidad | Alta |
| Mitigación | Mismas URLs en Astro (`/blog/[slug]`, `/page/[slug]`). Redirects 301 si cambia. Sitemap consistente. |
| Tracking | Audit SEO pre y post migración. NFR-004. |

---

## Matriz severidad / probabilidad

| Riesgo | Severidad | Probabilidad | Prioridad |
|--------|-----------|--------------|-----------|
| R1 Auth localStorage | Media | Baja (admin interno) | Media |
| R2 Consistencia visual | Media | Media | Media |
| R3 Build acoplado backend | Alta | Media | Alta |
| R4 Contenido stale | Media | Alta | Alta |
| R5 Deuda landing | Media | Alta | Media |
| R6 Referencias residuales | Baja | Baja | Baja |
| R7 Conflictos versiones | Media | Media | Media |
| R8 Webhook no fire | Media | Media | Media |
| R9 Carrito island | Baja | Baja (futuro) | Baja |
| R10 SEO regression | Alta | Baja (mismas URLs) | Alta |

## Prioridad de mitigación

1. **Alta**: R3 (build acoplado), R4 (contenido stale), R10 (SEO regression).
2. **Media**: R1, R2, R5, R7, R8.
3. **Baja**: R6, R9.