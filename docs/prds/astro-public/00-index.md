---
doc: astro-public/00-index
title: "Astro Public App — PRD Índice"
status: draft
created: 2026-08-20
---

# Astro Public App — PRD Índice

**Estado**: draft
**Owner**: Foundation (Q-015)
**Creado**: 2026-08-20
**Alcance**: App pública Astro (web + landing + blog + contacto) + extensión `web` en backend
**Referencia base**: `prds/astro-migration/` (borrador previo, parcialmente obsoleto — este PRD lo reemplaza)

## Resumen

PRD para la nueva app pública `apps/web/` (**Astro 7**) en el monorepo Foundation. Separa la web pública del backoffice admin (Nuxt se queda como admin puro). La web pública incluye landing (con formulario de contacto), blog editorial (con filtro por categoría, tags y búsqueda), páginas CMS, SEO (sitemap + RSS + JSON-LD), e i18n es/en consumiendo la API NestJS. Se añade una nueva extensión backend `web` para el endpoint de contacto (`POST /api/v1/contact`) con notificación por email y rate limiting. La estrategia de cache es **ISR DIY con Astro 7 `Astro.cache` + `routeRules`** (Astro NO tiene ISR nativo como Next.js): `output: 'server'` + adapter `@astrojs/node`, cache en memoria del proceso Node con `maxAge` + `swr` + `tags`, y un endpoint `POST /api/revalidate` que purga el cache por tag al recibir un webhook firmado (HMAC-SHA256 + timestamp) desde el CMS.

## Tabla de contenidos

| # | Archivo | Resumen |
|---|---------|---------|
| 00 | `00-index.md` | Este índice. Estado, owner, TOC, convenciones de numeración. |
| 01 | `01-overview.md` | Motivación, objetivos medibles, no-objetivos, KPIs. |
| 02 | `02-architecture.md` | Arquitectura target (3 apps), estructura `apps/web/`, modelo de render ISR DIY (Astro 7 `Astro.cache` + `routeRules`), flujo de contacto, decisiones con trade-offs. |
| 03 | `03-requirements.md` | FR-NNN (EARS) + NFR-NNN: landing, blog, contacto, ISR DIY, i18n, SEO, deploy. |
| 04 | `04-context.md` | Stack (Astro 7, Node 22.12, Rust compiler, Sätteri), aliases, dependencias, constraints three-tier, supuestos, limitaciones. |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos R-NNN (ISR, contacto, traducciones, SEO, Coolify) + trade-offs + matriz severidad. |
| 06 | `06-migration-phases.md` | 3 fases: Setup, Landing+Contacto, Blog+Pages+ISR. Entregables, exit criteria, rollback. |
| 07 | `07-open-questions.md` | Q-NNN resueltas y nuevas (ISR DIY, HMAC webhook, mapa evento→tag, newsletter, Maizzle). |
| 08 | `08-definition-of-done.md` | Gates funcionales, técnicos, performance, SEO, accesibilidad, seguridad. |

## Convenciones de numeración

- `FR-NNN` — requisitos funcionales (EARS notation en `03-requirements.md`).
- `NFR-NNN` — requisitos no funcionales.
- `Q-NNN` — open questions en `07-open-questions.md`.
- `R-NNN` — riesgos en `05-risks-and-tradeoffs.md` (formato `R-NNN`; prefijos temáticos `R-ISR-*`, `R-CONTACT-*`, `R-TRANSLATION-*`, `R-COOLIFY-*` para nuevos).
- `Fase <N>` — fases de migración en `06-migration-phases.md` (Fase 0 a Fase 2).

## Flujo posterior

```
PRD astro-public (este) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify
```

## Próximo paso

Open questions bloqueantes Q-016 (HMAC + timestamp) y Q-017 (mapa evento→ruta) RESUELTAS en este PRD. Q-020 (ubicación plantilla Maizzle) queda como PENDIENTE no bloqueante (se resuelve al inicio de Fase 1 con inspección de 5 min). Asignar owner (Q-015), aprobar Fase 0.