---
doc: cms/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack actual

| Capa | Tech | Versión |
|------|------|---------|
| Backend | NestJS | 11.1.2 |
| ORM | TypeORM | (en apps/back/package.json) |
| DB | PostgreSQL | vía docker-compose |
| Colas | `@nestjs/bullmq` 11 + `bullmq` | ya instalados |
| Cron | `@nestjs/schedule` 6.1 | ya instalado |
| Frontend | Nuxt 3 + Vue 3 | layer en `apps/front/extensions/cms/` |
| UI | DaisyUI 5.5 + Tailwind 4.1 | theming |
| Charts | `echarts` 5.5 + `vue-echarts` 7.0 | ya instalados |
| State | Pinia + TanStack Vue Query | ya en uso |
| Editor | TipTap v3 | `RichEditorAdvanced.vue` |

## Aliases

| Alias | Destino | Uso esperado |
|-------|---------|-------------|
| `@cms/*` | `apps/front/extensions/cms/*` | imports dentro del layer |
| `@base/ui-app/*` | `apps/front/modules/base/ui-app/*` | StatCard, BarChartCard, etc. |
| `@base/auth/stores/auth.store` | auth store | `useAuthStore()` para auto-author |
| `@ext/cms/*` (back) | `apps/back/src/extensions/cms/*` | cross-module refs dentro de extensiones |
| `@iam/roles/*` | roles + guards | RBAC |
| `@storage/*` | storage module | media upload |
| `@users/*` | users module | autor del post |

## Dependencias

| Dependencia | Razón |
|-------------|-------|
| `auth` | RBAC + identificación del autor logueado |
| `storage` | Media upload (featured image, inline editor) |
| `translations` | Contenido multilingüe vía `TranslationEntity` (entityName='BlogPost'|'Page') |
| `bullmq` + Redis | Cola de publicaciones programadas |
| `@nestjs/schedule` | Cronjob por minuto |
| `cron-parser` (FR base) | Calcular `scheduledPublishAt` y `CronNextRunsPreview` |
| `cronstrue` (FR base) | Texto humano del cron (opcional, para logs) |

## Constraints (three-tier)

### ✅ Always
- Usar componentes `@base/ui-app/components/` para charts/scheduling/automation (no crear custom).
- Imports con alias absolutos (`@cms/*`, `@base/*`), nunca relativas largas.
- `import type` para tipos-only (interfaces de composables, DTOs tipo).
- Logger NestJS en backend (no `console.log`).
- Tablas de extensión con prefijo `ext_cms_` (ya cumplido: `ext_cms_blog_post`, `ext_cms_page`, etc.).
- Slug único con validación regex en DTO (ya en `create-post.dto.ts`).
- Migraciones vía `pnpm migration:generate` + `pnpm migration:run` — nunca DDL hardcode.

### ⚠️ Ask first
- Añadir nueva columna a `ext_cms_blog_post` (`cronExpression`, `scheduledPublishAt`) → requiere migración.
- Añadir nuevo endpoint (`/cms/stats`, `/cms/blog/posts/:id/schedule`) → actualizar `extension.manifest.ts` `contributes.routes`.
- Crear nuevo rol CMS (`writer`, `editor`, `publisher`) → requiere seed de rol + update de `@Roles` decorators.

### 🚫 Never
- No modificar `app.module.ts` (auto-discovery).
- No tocar el sistema SEO actual (funciona).
- No romper SSR/SSG de páginas públicas.
- No hardcodear URLs/API keys en código.
- No usar `any` en nuevas firmas — `unknown` + guards.

## Supuestos asumidos

1. **Redis disponible**: Bull ya se usa en otros módulos (upload-post), se asume Redis corriendo. Si no, Q-08.
2. **AuthStore expone `user.firstName`/`lastName`**: confirmado en `docs/DECOUPLING.md` §5 (`User` interface).
3. **No hay fuente de views**: los FR-101 views card y FR-102 views trend se marcan `[NEEDS CLARIFICATION]` (Q-04). Si no hay fuente, los StatCards de views se omiten y se reemplazan por "días desde última publicación" (FR-107).
4. **CronExpression en 5 fields estándar**: compatible con `cron-parser` (FR base).
5. **`@nestjs/schedule` ya registrado globalmente**: si no, añadir `ScheduleModule.forRoot()` en infra (Q-09).
6. **Multi-idioma de slugs**: el sistema actual permite slug traducido vía `TranslationEntity` key='slug' — el scheduling no lo rompe.

## Relaciones relevantes

- **cms-audit** (hijo): consume datos de CMS para auditorías. Cualquier cambio en entidades CMS debe mantener compatibilidad con cms-audit.
- **translations**: el scheduler publica el post; las traducciones ya están guardadas, no hay acción extra.
- **sitemap**: tras publicación programada, el sitemap debería reflejar el nuevo post. Ver Q-07.