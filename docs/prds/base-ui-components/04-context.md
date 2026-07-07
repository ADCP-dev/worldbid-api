---
doc: base-ui-components/04-context
title: "Context — Stack, convenciones, dependencias, constraints"
status: draft
created: 2026-07-07
---

# 04 — Context

## Stack frontend actual

| Pieza | Versión | Origen |
|-------|---------|--------|
| Nuxt | ^4.3.1 | `apps/front/package.json` |
| Vue | ^3.5.13 | idem |
| Pinia | ^3.0.4 | idem |
| TanStack Vue Query | ^5.99.2 | idem |
| TanStack Vue Table | ^8.21.3 | idem |
| Tailwind CSS | ^4.1.3 | idem |
| DaisyUI | ^5.5.19 | idem (dev) |
| Zod | ^4.3.6 | idem |
| vee-validate + @vee-validate/zod | ^4.15.0 | idem |
| date-fns | ^4.1.0 | idem |
| @internationalized/date | ^3.11.0 | idem |
| echarts | 5.5.0 | idem |
| vue-echarts | 7.0.3 | idem |
| @tiptap/vue-3 | ^3.20.1 | idem |
| vue-draggable-plus | ^0.6.1 | idem |
| @vueuse/core | ^13.9.0 | idem |
| vue-sonner | ^1.3.2 | idem |
| @number-flow/vue | ^0.4.7 | idem |
| culori | ^4.0.2 | idem |
| lucide-vue-next | ^0.487.0 | idem |
| vue-i18n + @nuxtjs/i18n | ^11.2.8 | idem |
| @nuxtjs/color-mode | ^3.5.2 | idem (dev) |

**Libs NO presentes** (descartadas en D-01): chart.js, d3, apexchart,
unovis, visx, headlessui, radix-vue/reka-ui, vueuse/motion,
vue-final-modal, vue-chartjs.

## Path aliases

De `docs/TYPESCRIPT-GUIDELINES.md` + `nuxt.config.ts` principal:

| Alias | Destino | Uso |
|-------|---------|-----|
| `@` | `apps/front/` | composables, pages, components generales |
| `@base` | `apps/front/modules/base` | `@base/ui-app/components/...`, `@base/auth/...` |
| `@cms` | `apps/front/modules/cms` | solo módulo cms (legacy) |
| `@landing` | `apps/front/modules/landing` | solo módulo landing |

Extensions se registran en `extends` array + alias `@<name>` en
`nuxt.config.ts` principal (patrón `docs/FRONTEND-LAYERS.md`). Imports
entre extensions pasan por `@base/ui-app/...` para componentes UI.

## Convención de componentes base

Regla de oro (`docs/DECOUPLING.md` sección 10 + skill `frontend`):

> SIEMPRE usar componentes de `@base/ui-app/components/`. NUNCA crear
> componente custom si ya existe uno base.

Catálogo actual (ver `02-architecture.md`):
- **Form (11)**: FormInput, FormTextArea, FormSelect, FormSearchSelect,
  FormMultipleSelect, FormDate, FormTime, FormPassword, FormSwitch,
  FormFile, FormMultipleFile.
- **DataTable (7)**: DataTable, DataTableComboboxFilter,
  DataTableColumnHeader, SortableHeader, EditButton, ViewButton,
  DeleteButton.
- **Kanban**: Kanban + KanbanColumn + KanbanCard + KanbanTag + UserAvatar.
- **Calendar**: Calendar + CalendarToolbar + 3 views + CalendarEvent +
  useCalendar.
- **Rich editor**: RichEditor.

Patrones internos:
- `defineModel()` para v-model (excepto FormFile/MultipleSelect/MultipleFile).
- `types.ts` por carpeta (`kanban/types.ts`, `calendar/types.ts`).
- Iconos `lucide-vue-next`.
- `lib/forms/validateForm.ts` + `lib/forms/rules/checkFileType.ts`.
- `stores/useTableState.ts` (Pinia persistido) para estado de tablas.
- Demos en `pages/app/components/` (data-table, form, kanban, calendar,
  rich-editor, form-components).

## API composables

De `docs/FRONTEND-LAYERS.md`:
- `useApi()` reemplaza `fetchWrapper` (DEPRECATED). 401 → refresh →
  retry → logout.
- Una composable por entidad con TanStack Query:
  `use<Entity>Query`, `useCreate<Entity>Mutation`, etc.
- `useState<NavMenu[]>('nav:menuItems')` para sidebar inyectado por
  `plugins/nav.ts` de cada extensión.
- `useState<DashboardEntry[]>('app:dashboards')` para tabs del dashboard
  principal (`pages/app/index.vue`).

## Dependencias relevantes ya disponibles

| Dependencia | Uso en este PRD |
|-------------|-----------------|
| `echarts` + `vue-echarts` | Charts wrappers (D-01) |
| `@number-flow/vue` | StatCard anim count-up |
| `date-fns` | CronScheduleEditor preview, WeekdayPicker días |
| `@internationalized/date` | TimeWindowPicker (ya usado por FormDate) |
| `@vueuse/core` | useEventListener, onClickOutside, onKeyStroke |
| `vue-sonner` | Toasts en FieldRelation errores |
| `zod` | JsonSchemaEditor validación |
| `lucide-vue-next` | Iconos StatCard/EmptyState/RadioCards |
| `culori` | Charts color manipulation (paleta theme) |
| `vue-i18n` + `@nuxtjs/i18n` | Strings traducibles (NFR-020) |

## Constraints (three-tier boundaries)

### ✅ Always

- Usar DaisyUI + Tailwind para estilos (NFR-040).
- Path aliases `@base/ui-app/components/...` para imports (D-04).
- `import type` para interfaces (NFR-051).
- `defineModel()` para v-model en componentes nuevos.
- `types.ts` por carpeta nueva (NFR-050).
- Iconos `lucide-vue-next`.
- `$t()` para strings visibles (NFR-020).
- Tests con `it("should ...")` (regla ESLint).
- Lazy-import `vue-echarts` dentro de charts (NFR-002).
- Funciones < 30 líneas (regla TS guidelines).
- `NullableType<T>` / `MaybeType<T>` para nuleables (NFR-052).

### ⚠️ Ask first

- Añadir nueva dependencia npm a `apps/front/package.json`. En este PRD
  no se propone ninguna nueva — todos los componentes usan libs ya
  presentes (D-01). Si Q-001 resuelve a favor de custom SVG, se
  eliminaría la dependencia de echarts y eso requeriría confirmación.
- Cambiar el `pathPrefix` strategy en `nuxt.config.ts` (afecta
  nomenclatura de imports — Q-004).
- Añadir dependencias peer a `echarts` (extensiones como
  `echarts-gl`, `echarts-stat`). Solo si un chart específico lo requiere
  y el PRD de extensión lo justifica.

### 🚫 Never

- Crear componente custom si ya existe en `@base/ui-app` (regla de oro).
- Rutas relativas largas (`../../../`) — usar alias.
- `console.log` — usar `vue-sonner` o logger del proyecto.
- `any` — usar `unknown` + guards o `NullableType<T>`.
- Hardcodear URLs/tokens — `useRuntimeConfig()`.
- Colores hex inline en componentes — usar variantes DaisyUI (NFR-040).
- Sobre-especificar implementación en este PRD (describir QUÉ, no CÓMO).
- Editar `app.module.ts` backend o `nuxt.config.ts` principal sin
  justificación explícita en el PRD de extensión.

## Supuestos asumidos

- **Asumido** que `cms-audit` no tiene implementación backend ni
  frontend (reporte explore lo confirma) — por eso no aparece como
  consumidor. Si se implementa, consumirá los mismos componentes base.
- **Asumido** que `analytics` frontend usa endpoints externos al repo
  (no están en `apps/back`) — sus charts ya son inline con echarts y no
  se migran en este PRD.
- **Asumido** que `tokens` no tiene UI visible — no aparece como
  consumidor.
- **Asumido** que la regla `defineModel()` se aplica a componentes nuevos
  (alineado con la mayoría de los form components existentes; la deuda
  técnica de FormFile/MultipleSelect no se propaga).
- **Asumido** que `date-fns` locale `es` es el default (confirmado en
  `useCalendar.ts`) — los nuevos componentes scheduling siguen el mismo
  locale por defecto pero respetan el locale activo de `@nuxtjs/i18n`.
- **Asumido** que cada extensión ya tiene su `plugins/dashboard-widgets.ts`
  registrado y el dashboard principal los orquesta vía
  `useState('app:dashboards')` — no se modifica ese mecanismo.
- **Asumido** que `@nuxtjs/color-mode` ya soporta multi-theme y los
  componentes solo necesitan usar clases DaisyUI.