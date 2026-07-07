---
doc: astro-migration/01-overview
title: "Visión General"
status: draft
created: 2026-07-07
---

# Visión General

## Resumen ejecutivo

Foundation separa la **web pública** del **backoffice admin**. El backoffice se queda en Nuxt (`apps/front/`) porque es una app interactiva. La web pública migra a **Astro** (`apps/web/`) porque es contenido con foco en SEO, performance y futuro ecommerce. Patrón arquitectural: **BFF separation + static edge**.

```
        ┌──────────────────┐
        │   NestJS API     │
        │   (apps/back/)   │
        └────────┬─────────┘
                 │
        ┌────────┴─────────┐
        │                  │
┌───────▼────────┐  ┌──────▼─────────┐
│  Nuxt admin    │  │  Astro web     │
│  apps/front/   │  │  apps/web/     │
│  App interactiva│  │  Contenido    │
│  Node server   │  │  CDN estático │
└────────────────┘  └────────────────┘
```

## Problema / motivación

Nuxt layers no tienen boundaries reales. La landing "liviana" arrastra auth store, TanStack Query, i18n hook con fetch a backend, build dual Node+SSG, y rutas con `prerender:false` que obligan a correr Node server en runtime. Backoffice es APP (Nuxt correcto); web pública es CONTENIDO (Astro correcto). Tools distintas para naturalezas distintas.

Estado actual verificado:
- 226 archivos `.vue` en `apps/front/`.
- 11 `extends` en `nuxt.config.ts` (modules/landing + modules/base + 9 extensions).
- Auth client-side (Pinia + `localStorage` + JWT + refresh).
- i18n dinámico vía hook `i18n:registerModule` que fetchea backend en startup.

## Objetivos (medibles)

| # | Objetivo | Criterio de éxito |
|---|----------|-------------------|
| O1 | Definir arquitectura target con responsabilidades claras por app | Documento `02-architecture.md` aprobado |
| O2 | Especificar `apps/web/` Astro: stack, estructura, render, deploy | `03-requirements.md` + `10-deploy-and-infra.md` |
| O3 | Especificar limpieza de `apps/front/` post-migración | Checklist Fase 4 en `06-migration-phases.md` |
| O4 | Definir `packages/ui/` design tokens compartidos | Tokens + Tailwind preset + DaisyUI theme exportados |
| O5 | Definir estrategia i18n y content para Astro | `11-content-and-i18n.md` sin `[NEEDS CLARIFICATION]` bloqueante |
| O6 | Plan de migración incremental sin big-bang | Fases 0-4 con criterios de salida y rollback |
| O7 | Preparar terreno para extensión ecommerce futura | `09-ecommerce-future.md` con convenciones `ext_ecommerce_*` |

## No-objetivos (out-of-scope)

- Migración del backoffice admin (se queda en Nuxt).
- Refactor del backend NestJS (solo ajustes mínimos: CORS, endpoints lectura públicos).
- Migración de auth a httpOnly cookies (recomendada, no bloqueante — ver R1).
- Implementación de ecommerce (solo preparación arquitectural — ver `09-ecommerce-future.md`).
- Port directo de componentes Vue a Astro (se reescriben).

## KPIs / métricas de éxito

| Métrica | Target | Verificación |
|---------|--------|--------------|
| Landing en Astro desplegada | `apps/web/` sirve `/` en producción | Deploy Fase 1 |
| Cero JS en landing | Lighthouse "Eliminate render-blocking" 100, JS payload < 10 KB | Lighthouse CI |
| Core Web Vitals | LCP < 2.5 s, CLS < 0.1, INP < 200 ms | Lighthouse CI |
| Blog migrado | `/blog/**` servido desde Astro | Fase 2 |
| Nuxt limpio | `apps/front/` sin `modules/landing`, sin `extensions/cms/pages/{blog,page}` | Fase 4 + grep |
| Deploy dual operativo | CI/CD separado por app, deploy independiente | `10-deploy-and-infra.md` |
| Backoffice sin regresiones | `/app/**` intacto en Nuxt | Smoke test post-Fase 4 |
| SEO | Sitemap + RSS + JSON-LD + OG images generados desde Astro | `11-content-and-i18n.md` |

## Próximos pasos

1. Confirmar open questions bloqueantes en `07-open-questions.md` (Q-001, Q-002, Q-015).
2. Asignar owner.
3. Aprobar Fase 0 (setup) en `06-migration-phases.md`.