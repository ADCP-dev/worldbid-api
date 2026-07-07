---
doc: astro-migration/08-definition-of-done
title: "Definition of Done"
status: draft
created: 2026-07-07
---

# Definition of Done

Criterios **objetivos** para considerar la migración completa. Cada criterio es verificable automáticamente o por checklist explícito.

## Por fase (criterios de salida)

Los criterios de salida de cada fase están definidos en `06-migration-phases.md`. Esta sección define el DoD global de toda la migración.

## Tests

| Tipo | Requisito | Verificación |
|------|-----------|--------------|
| Smoke test visual Fase 1 | Landing Astro vs landing Nuxt con paridad razonable | Captura visual comparativa en staging |
| Smoke test funcional Fase 4 | `/app/**` funciona sin regresiones | Login + dashboard + CRUD users + CRUD post |
| Webhook rebuild Fase 2 | Admin edita page → rebuild dentro de 60 s | Test manual en staging |
| Build estático Fase 0 | `pnpm --filter web build` produce `dist/` sin errores | CI gate |
| Type-check | `pnpm check-types` pasa en `apps/web`, `apps/front`, `packages/ui`, `apps/back` | CI gate (NFR-010) |

> No se requiere coverage unit test mínimo para el PRD (el contenido estático no tiene lógica unit-testeable significativa). Si se agregan utilidades en `apps/web/src/lib/`, cubrirlas con unit tests.

## Lint

| Gate | Comando | Verificación |
|------|---------|--------------|
| ESLint | `pnpm lint` (todas las workspaces) | Sin errores. Warnings permitidos solo con justificación. |
| Prettier | `pnpm format` (check) | Sin diffs (archivos ya formateados). |
| NFR-011 | Cumplir `pnpm lint` passing | CI gate |

## Type-check

| Gate | Comando |
|------|---------|
| TypeScript estricto | `pnpm check-types` pasa en `apps/web`, `apps/front`, `packages/ui`, `apps/back` |
| NFR-010 | Sin errores de tipos |

## Build

| Gate | Comando | Output esperado |
|------|---------|------------------|
| Astro build | `pnpm --filter web build` | `apps/web/dist/` estático servible desde CDN |
| Nuxt build | `pnpm --filter front build` | `apps/front/.output/` (Node server o SPA según Q-010) |
| NestJS build | `pnpm --filter back build` | `apps/back/dist/` |
| `packages/ui` build | `pnpm --filter @foundation/ui build` | `packages/ui/dist/` consumible |

## Documentación

| Requisito | Verificación |
|-----------|--------------|
| `docs/ARCHITECTURE.md` actualizado | `pnpm docs:sync` ejecutado sin errores |
| Doc módulo/extension afectada | `.md` con frontmatter YAML válido (`id`, `type`, `dependencies`) |
| PRD actualizado | Open questions resueltas marcadas como `resolved` con fecha y decisión |
| `apps/web/README.md` | Stack, estructura, scripts, deploy (mínimo) |

## Deploy

| Criterio | Verificación |
|----------|--------------|
| `apps/web/` desplegado en prod | `https://midominio.com/` sirve landing Astro (HTTP 200) |
| DNS apunta a Astro | `dig midominio.com` resuelve al CDN |
| Nuxt admin desplegado | `https://app.midominio.com/app/dashboard` funciona (o path proxy según Q-002) |
| NestJS API desplegado | `https://api.midominio.com/health` (o equivalente) responde 200 |
| Pipelines CI/CD separados | Push a `apps/web/**` no dispara deploy de `apps/front/**` y viceversa |

## Performance (NFR-001, NFR-002, NFR-003)

| Métrica | Target | Verificación |
|---------|--------|--------------|
| Lighthouse performance landing | >= 95 | Lighthouse CI en staging |
| JS payload landing | < 10 KB (ideal 0 KB) | Lighthouse CI |
| LCP landing | < 2.5 s | Lighthouse CI |
| CLS landing | < 0.1 | Lighthouse CI |
| INP landing | < 200 ms | Lighthouse CI |

## SEO (NFR-004, NFR-005)

| Criterio | Verificación |
|----------|--------------|
| URLs consistentes | Mismas rutas que Nuxt actual (`/blog/[slug]`, `/page/[slug]`). Sin 404. |
| Sitemap válido | `https://midominio.com/sitemap-index.xml` accesible, parsea sin errores |
| RSS válido | `https://midominio.com/rss.xml` accesible, validador RSS sin errores |
| JSON-LD válido | Schema.org validator sin errores en `/`, `/blog`, `/blog/[slug]` |
| Redirects 301 | Solo si URL cambia. Log de redirects en CI. |
| Audit SEO pre/post | Pre-migración: snapshot URLs + rankings. Post: mismo snapshot + diff. |

## Accesibilidad (NFR-006)

| Criterio | Verificación |
|----------|--------------|
| WCAG 2.1 AA | Lighthouse Accessibility >= 95 + axe-core scan sin errores críticos |
| Navegable por teclado | Tab a través de landing + blog post sin traps |
| Contraste AA | Lighthouse + manual en componentes clave |

## Seguridad (NFR-008, NFR-009)

| Criterio | Verificación |
|----------|--------------|
| Sin secrets en bundle estático | `grep -r "SECRET\|API_KEY\|JWT_SECRET" apps/web/dist/` sin resultados |
| CORS whitelist NestJS | `apps/back` CORS config lista solo `midominio.com` y `app.midominio.com` |
| Sin `localStorage` tokens en Astro | Astro no maneja auth — confirmado por grep |

## Limpieza Nuxt (FR-022, FR-023, FR-024)

| Criterio | Verificación |
|----------|--------------|
| `apps/front/` sin `modules/landing/` | `Test-Path apps/front/modules/landing` = false |
| `apps/front/` sin `extensions/cms/pages/blog/` | Glob no encuentra archivos |
| `apps/front/` sin `extensions/cms/pages/page/` | Glob no encuentra archivos |
| `nuxt.config.ts` sin `modules/landing` en extends | Grep no encuentra |
| `routeRules` sin `/blog/**`, `/page/**`, `/`, `/en` | Grep no encuentra |
| Alias `@landing` removido | Grep no encuentra en `nuxt.config.ts` ni `tsconfig.json` |
| `/app/**` funcional | Smoke test manual |
| Auth pages funcionales | Smoke test `/login`, `/register`, `/forgot-password` |

## Verificación final (checklist)

- [ ] Todos los FR-NNN relevantes cumplidos (ver `03-requirements.md`)
- [ ] Todos los NFR-NNN cumplidos
- [ ] Open questions bloqueantes (Q-001, Q-002, Q-015) resueltas
- [ ] Tests gate passing
- [ ] Lint + type-check passing
- [ ] Build passing en todas las apps
- [ ] Docs actualizadas + `pnpm docs:sync` ejecutado
- [ ] Deploy en prod funcional (web + admin + API)
- [ ] Lighthouse passing en prod
- [ ] SEO audit post-migración sin regresiones
- [ ] Nuxt admin limpio (FR-022, FR-023, FR-024)
- [ ] Decisiones clave guardadas en Engram (`mem_save`)

## Out of DoD (no aplica)

- Migración de auth a httpOnly cookies (recomendada, no bloqueante — ver Q-004, R1).
- Implementación ecommerce (solo preparación — ver `09-ecommerce-future.md`, Fase 3).
- Migración del backoffice admin a otra tecnología.