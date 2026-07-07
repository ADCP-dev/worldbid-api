---
doc: cms-audit/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack actual

| Layer | Tech |
|-------|------|
| Backend | NestJS + TypeORM + PostgreSQL + BullMQ (`@nestjs/bullmq` 11.0.4) + `@nestjs/schedule` 6.1.1 |
| Frontend | Nuxt 3 + Vue 3 + DaisyUI 5.5.19 + Tailwind 4.1.3 + Pinia + TanStack Query + ECharts (`vue-echarts` 7.0.3) |
| Monorepo | Turborepo |
| Auth | JWT + RBAC con decorators y guards (`@iam/auth`) |

## Aliases

**Backend** (`tsconfig.json`):
- `@ext/cms-audit/*` → `src/extensions/cms-audit/*` (a configurar)
- `@ext/cms/*` → `src/extensions/cms/*` (ya existe)
- `@iam/*` → `src/modules/iam/*`
- `@infra/*` → `src/infrastructure/*`
- `@src/*` → `src/*`

**Frontend**:
- `@cms-audit` → `apps/front/extensions/cms-audit` (a configurar en `nuxt.config.ts`)
- `@base/ui-app` → `apps/front/modules/base/ui-app` (ya existe)
- `@` → `apps/front/`

## Convenciones

| Convención | Regla |
|------------|------|
| Tablas extensión | Prefijo `ext_cms_audit_*` (ej: `ext_cms_audit_run`, `ext_cms_audit_finding`, `ext_cms_audit_run_config`) |
| Module file | `extension.module.ts` (auto-discovered por `ExtensionLoaderModule`) |
| Manifest file | `extension.manifest.ts` con `dependencies: { extensions: ['cms', 'auth', 'storage', 'translations'] }` |
| Frontend | Carpeta en `apps/front/extensions/cms-audit/` (NO `modules/`) — coherente con `extensions/cms/` |
| Imports | Alias absolutos `@ext/cms-audit/*`, `@base/ui-app/components/...`. Nunca relativas largas. |
| Tipos | `import type` para interfaces/types. |
| Logger | NestJS `Logger` — nunca `console.log`. |
| Tests | `it("should ...")` — requerido por ESLint. |
| Generadores | NUNCA escribir entity/service/controller a mano — usar `pnpm generate:extension`. |

## Dependencias

### Backend
- `@nestjs/bullmq` (instalado) — cola de auditorías.
- `@nestjs/schedule` (instalado) — cron dinámico para audits recurrentes.
- `@ext/cms/*` — consume repositorios públicos de Page, BlogPost, SeoMetadata (read-only).
- `@iam/auth` — guards y decorators de permisos.
- `@infra/utils/types` — `NullableType`, `MaybeType`.

### Frontend
- `@base/ui-app/components/charts/*` — `StatCard`, `TrendChart`, `BarChartCard`, `DonutChartCard`, `GaugeChartCard` (PRD base-ui-components).
- `@base/ui-app/components/scheduling/*` — `CronScheduleEditor`, `WeekdayPicker`, `CronNextRunsPreview` (PRD base-ui-components).
- `@base/ui-app/components/automation/*` — `LinkedSelect` (PRD base-ui-components).
- `@base/ui-app/components/data-table/*` — `DataTable`, filtros.
- TanStack Query — hooks en `useCmsAudit.ts`.
- `cron-parser` + `cronstrue` (deps del PRD base, ⚠️ Ask first) — preview de próximas ejecuciones.

## Constraints (three-tier)

- ✅ **Always**: Tablas con prefijo `ext_cms_audit_*`. Auto-discovery module. Read-only sobre CMS parent. Logger NestJS. `import type` para tipos. Permisos RBAC en controllers.
- ⚠️ **Ask first**: Añadir deps nuevas al backend (cron-parser etc. ya cubiertas por PRD base). Modificar `nuxt.config.ts` para alias `@cms-audit`. Crear archivo i18n nuevo.
- 🚫 **Never**: Modificar `apps/back/src/extensions/cms/` (parent, read-only). Escribir entity/service/controller a mano (usar `pnpm generate:extension`). Hardcodear URLs/idiomas. `console.log`. Usar `any` (usar `unknown` + guards). `git checkout`/`git switch` (worktree).

## Supuestos asumidos

1. **Asumido**: la extensión `cms` parent expone repositorios públicos consultables desde `cms-audit`. Verificable leyendo `apps/back/src/extensions/cms/` — los services están exportados en `cms.module.ts`.
2. **Asumido**: `@nestjs/bullmq` y `@nestjs/schedule` ya configurados a nivel app (no por extensión). Si no, cms-audit los configura en su `extension.module.ts`.
3. **Asumido**: el catálogo base-ui-components (FR-001..FR-021) estará implementado ANTES que este PRD se ejecute. Si no, los componentes se marcan como bloqueantes.
4. **Asumido**: i18n dinámico — los strings viven en `apps/front/i18n/locales/{es,en}/` (no en `src/i18n/` del back). Es coherente con el stack Nuxt.
5. **Asumido**: los checks son deterministic y reproducibles (no usan datos externos tipo Google Search Console).