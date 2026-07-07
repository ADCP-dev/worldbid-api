---
doc: astro-migration/00-index
title: "Migración a Astro — Índice"
status: draft
created: 2026-07-07
---

# Migración a Astro — Índice

## Metadata

| Campo | Valor |
|-------|-------|
| Slug | `astro-migration` |
| Estado | draft |
| Owner | Por asignar (Q-015) |
| Creado | 2026-07-07 |
| Actualizado | 2026-07-07 |
| Tipo | Migración arquitectural |
| Alcance | Web pública (Astro) + limpieza backoffice (Nuxt) + package compartido |

## Tabla de contenidos

| # | Archivo | Tema |
|---|---------|------|
| 00 | `00-index.md` | Este índice + metadata |
| 01 | `01-overview.md` | Resumen, problema, objetivos, KPIs |
| 02 | `02-architecture.md` | Arquitectura target + decisiones con trade-offs |
| 03 | `03-requirements.md` | FR-NNN (EARS) + NFR-NNN |
| 04 | `04-context.md` | Stack, aliases, convenciones, three-tier constraints |
| 05 | `05-risks-and-tradeoffs.md` | Riesgos R1-R10 + matriz severidad |
| 06 | `06-migration-phases.md` | Fases 0-4 incrementales + rollback |
| 07 | `07-open-questions.md` | Q-001 a Q-015 pendientes |
| 08 | `08-definition-of-done.md` | Criterios objetivos de finalización |
| 09 | `09-ecommerce-future.md` | Preparación extensión ecommerce |
| 10 | `10-deploy-and-infra.md` | Deploy dual, hosting, dominios, CI/CD |
| 11 | `11-content-and-i18n.md` | Content strategy + i18n unificados |

## Cómo leer este PRD

1. **Visión**: leer `01-overview.md` → `02-architecture.md`.
2. **Requisitos para implementar**: `03-requirements.md` + `04-context.md`.
3. **Plan de ejecución**: `06-migration-phases.md` → `08-definition-of-done.md`.
4. **Decisiones pendientes**: `07-open-questions.md` (bloqueantes marcadas).
5. **Especializado**: `09-ecommerce-future.md`, `10-deploy-and-infra.md`, `11-content-and-i18n.md`.

## Convenciones de numeración

- `FR-NNN` — requisitos funcionales (EARS notation en `03-requirements.md`).
- `NFR-NNN` — requisitos no funcionales.
- `Q-NNN` — open questions en `07-open-questions.md`.
- `R<N>` — riesgos en `05-risks-and-tradeoffs.md` (R1-R10).
- `Fase <N>` — fases de migración en `06-migration-phases.md` (Fase 0 a Fase 4).

## Próximo paso

Confirmar open questions bloqueantes (Q-001 hosting, Q-015 owner), asignar owner, aprobar Fase 0.