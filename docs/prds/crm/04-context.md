---
doc: crm/04-context
title: "Contexto"
status: draft
created: 2026-07-07
---

# Contexto

## Stack

### Backend (`apps/back/`)
- **Framework**: NestJS + TypeORM + PostgreSQL.
- **Queues**: `bullmq` ^5.68 (instalado, CRM no lo usa aún).
- **Scheduling**: `@nestjs/schedule` ^6.1.1 (instalado, CRM no lo usa aún).
- **Email**: `nodemailer` 6.10.1 (vía módulo `email`, dependencia `auth`).
- **Validación**: class-validator en DTOs.
- **Docs API**: Swagger via `@nestjs/swagger`.
- **RBAC**: `@iam/roles/` con `@Roles()` decorator + `RolesGuard`.

### Frontend (`apps/front/`)
- **Framework**: Nuxt 3 (4.3.1) + Vue 3.5 + `<script setup lang="ts">`.
- **Styling**: Tailwind CSS 4.1 + DaisyUI 5.5.
- **State**: Pinia 3 + `persistedstate`. Auth en `useAuthStore()`.
- **Data fetching**: TanStack Vue Query 5.99 + `useCrm()` composable (wrapper de `$fetch` con Bearer).
- **Forms**: vee-validate 4 + zod 4 + componentes base `@base/ui-app/`.
- **Tables**: TanStack Vue Table 8.21.
- **Charts**: ECharts 5.5 + vue-echarts 7.0.3 (instalados).
- **i18n**: vue-i18n 11 + @nuxtjs/i18n 10. Locales en `apps/front/i18n/locales/{es,en}/`.
- **Icons**: lucide-vue-next.
- **Toast**: vue-sonner.

## Path aliases

| Alias | Destino | Ejemplo CRM |
|-------|---------|-------------|
| `@` | `apps/front/` | `@/composables/useAuthStore` |
| `@base` | `apps/front/modules/base` | `@base/ui-app/components/charts/StatCard.vue` |
| `@crm` | `apps/front/extensions/crm` | `@crm/types`, `@crm/composables/useCrm` |
| `@ext/crm` | `apps/back/src/extensions/crm` | `@ext/crm/services/crm-dashboard.service` |
| `@iam/*` | `apps/back/src/modules/iam/*` | `@iam/roles/roles.decorator` |

**Regla ORO**: SIEMPRE componentes `@base/ui-app/`. NUNCA crear custom si existe uno base.

## Dependencias

### Backend
- `auth` (declarada en `extension.manifest.ts` `dependencies: ['auth']`).
- `email` (transitiva vía auth, para weekly report si Q-003 aprobado).
- Sin dependencias de otras extensiones (CRM es base — `affiliate` depende de CRM, no al revés).

### Frontend
- `@base/ui-app/` (componentes base).
- `@base/auth/` (auth store, middlewares `auth`, `admin`).
- Sin dependencias de otros layers frontend.

## Convenciones verificadas en código existente

- **Entity**: `@Entity('ext_crm_client')` con prefijo ✅. `EntityRelationalHelper` extendido. `@Index` en campos filtrables.
- **Relaciones**: `@ManyToOne` con `onDelete` correcto (CASCADE para hijos, SET NULL para opcionales, RESTRICT para status). Ver `docs/DECOUPLING.md` §7.
- **Controller**: `@Controller({ path: 'crm/<resource>', version: '1' })` + `@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(RoleEnum.admin)`.
- **Service**: `Injectable()` + `Logger` privado. Métodos `findAll/findOne/create/update/softDelete`.
- **Seed**: upsert idempotente (findOne → create/update). Auto-discovered vía `seeds/seed.module.ts` con clase `*SeedModule`.
- **Composable frontend**: `useCrm()` retorna objeto con métodos async. `$fetch` con `Bearer ${authStore.token}`.
- **Page**: `definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] })`.
- **Toast**: `vue-sonner` `toast.error/success`.

## Composables relevantes

- `useCrm()` — wrapper API CRM (26 métodos). Vive en `extensions/crm/composables/useCrm.ts`.
- `useAuthStore()` — estado auth, getter `isAdmin`.
- `useThemeColors()` — colores DaisyUI → ECharts. Vive en `apps/front/composables/useThemeColors.ts`.
- `useRuntimeConfig()` — `public.apiUrl`, `public.apiPrefix`.

## Locales existentes

```
apps/front/i18n/locales/
├── es/
│   ├── cms.json
│   └── landing.json
└── en/
    ├── cms.json
    └── landing.json
```

**Falta**: `es/crm.json` y `en/crm.json`. Crear como parte del DoD. Namespace `crm.*`.

## Constraints (three-tier)

| Tier | Constraint |
|------|------------|
| ✅ Always | Usar componentes `@base/ui-app/components/{charts,automation,scheduling}/` (catálogo base). |
| ✅ Always | Refactor `CrmDashboard.vue` para consumir catálogo — cero stat/barras manuales. |
| ✅ Always | `LinkedSelect` (FR-021 base) para encadenar selects dependientes. |
| ✅ Always | i18n vía JSON en `apps/front/i18n/locales/`, namespace `crm`. |
| ✅ Always | DaisyUI semantic classes + `useThemeColors()` para charts. |
| ✅ Always | TypeScript estricto, `import type` para tipos. |
| ✅ Always | Alias `@crm/*`, `@ext/crm/*`, `@base/ui-app/*` (no relativas largas). |
| ✅ Always | NestJS `Logger` — NO `console.log`. |
| ✅ Always | RBAC admin-only en todos los endpoints nuevos. |
| ✅ Always | `pnpm migration:generate` + `pnpm migration:run` para schema changes (NO hardcode SQL). |
| ✅ Always | Soft-delete con `@DeleteDateColumn` (ya existe en entities). |
| ⚠️ Ask first | Añadir `ownerId` FK a `CrmClientEntity` (migración + seed round-robin). Ver Q-004. |
| ⚠️ Ask first | Añadir `CronScheduleEditor` + `@Cron` + `bullmq` queue para weekly report. Ver Q-003. |
| ⚠️ Ask first | Integración email Gmail/Outlook (oauth, webhook inbound). Ver Q-001. |
| ⚠️ Ask first | Enriquecimiento auto vía LinkedIn/Clearbit (PII concerns). Ver Q-002. |
| 🚫 Never | Crear chart custom si existe en catálogo base. |
| 🚫 Never | Hardcodear colores, URLs, tokens, PII en logs. |
| 🚫 Never | Escribir entity/service/controller/DTO a mano — usar generadores Hygen para nuevos resources. |
| 🚫 Never | `console.log` — usar `Logger` (back) o `vue-sonner` (front). |
| 🚫 Never | Exponer PII (email, phone, nif) en logs o respuestas públicas. |

## Supuestos asumidos

- **Asumido**: el catálogo `base-ui-components` (PRD referenciado) estará implementado antes que este PRD entre a `sdd-apply`. Si no, los FR-001..FR-005 se bloquean.
- **Asumido**: `CrmDashboardService.getDashboard()` actual retorna `clientsByStatus`, `clientsByOrigin`, `projectsByStatus`, `recentInteractions` — se extiende, no se rompe.
- **Asumido**: `CrmProjectEntity.price` es el valor mensual recurrente (no valor total del proyecto). Si es total, MRR se calcula diferente. [NEEDS CLARIFICATION — Q-008].
- **Asumido**: los `CrmStatusEntity.label` ("Lead", "Discovery", etc.) son display names suficientes para los charts; NO se i18n-nizan (son datos del cliente). Los headers de cards sí via i18n.
- **Asumido**: el timezone del usuario (`Intl...resolvedOptions().timeZone`) es suficiente para `CronNextRunsPreview` si Q-003 se aprueba.
- **Asumido**: el plugin `dashboard-widgets.ts` ya existe en CRM frontend (inyección de widgets cross-extensión). No se modifica — fuera de scope.