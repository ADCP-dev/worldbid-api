---
doc: base-ui-components/02-architecture
title: "Architecture — Dónde viven los componentes y cómo se relacionan"
status: draft
created: 2026-07-07
---

# 02 — Architecture

## Arquitectura actual de `@base/ui-app`

Path raíz: `apps/front/modules/base/ui-app/`.

```
ui-app/
├── components/
│   ├── form/           11 componentes, pathPrefix: false
│   ├── data-table/     DataTable + filters/ + buttons/, pathPrefix: true
│   ├── kanban/         Kanban + 5 subcomponentes + types.ts
│   ├── calendar/       Calendar + 6 subcomponentes + composables/useCalendar.ts + types.ts
│   └── rich-editor/    RichEditor (Tiptap)
├── lib/forms/          validateForm.ts, rules/checkFileType.ts
├── pages/app/components/   6 demos (data-table, form, kanban, calendar, rich-editor, form-components)
├── plugins/nav.ts     Inyecta menú "UI App" (solo dev)
└── stores/useTableState.ts  Pinia persistido (estado tablas)
```

Registro en `apps/front/modules/base/ui-app/nuxt.config.ts:11`:
```ts
components: [
  { path: "./components", pathPrefix: false },
  { path: "./components/data-table", pathPrefix: true },
  { path: "./components/form", pathPrefix: false },
  { path: "./components/rich-editor", pathPrefix: false },
]
```

**Convenciones establecidas**:
- Carpeta por categoría con `pathPrefix` configurado.
- `types.ts` por carpeta para interfaces compartidas (`kanban/types.ts`,
  `calendar/types.ts`, `data-table/types.ts`).
- `defineModel()` para v-model (excepto `FormFile`, `FormMultipleSelect`,
  `FormMultipleFile` que usan `modelValue` + emit clásico — deuda técnica
  previa).
- Iconos de `lucide-vue-next`.
- i18n via `vue-i18n` + `@nuxtjs/i18n`.
- Drag&drop via `vue-draggable-plus` (Kanban).
- Fechas via `date-fns` (Calendar) + `@internationalized/date` (FormDate).

## Dónde se ubicarán los nuevos componentes

Siguiendo la convención de carpeta-por-categoría:

```
ui-app/components/
├── form/                  (existente — añadir 4 aquí)
│   ├── FormInput.vue, FormTextArea.vue, ... (existentes)
│   ├── WeekdayPicker.vue         NUEVO
│   ├── TimeWindowPicker.vue      NUEVO
│   ├── KeyValueEditor.vue        NUEVO
│   └── ToggleGroup.vue           NUEVO
├── data-table/            (existente — sin cambios)
├── kanban/                (existente — sin cambios)
├── calendar/              (existente — sin cambios)
├── rich-editor/           (existente — sin cambios)
├── scheduling/           NUEVA carpeta
│   ├── CronScheduleEditor.vue
│   ├── types.ts
│   └── lib/cronToHuman.ts  utilidad de parseo cron → texto
├── dashboard/             NUEVA carpeta
│   ├── StatCard.vue
│   ├── LineChart.vue
│   ├── BarChart.vue
│   ├── DonutChart.vue
│   ├── TimelineList.vue
│   ├── EmptyState.vue
│   └── types.ts
└── automation/            NUEVA carpeta
    ├── RadioCards.vue
    ├── JsonSchemaEditor.vue
    ├── FieldRelation.vue
    └── types.ts
```

**Registro `nuxt.config.ts`** — añadir al array `components`:
```ts
{ path: "./components/scheduling", pathPrefix: true },
{ path: "./components/dashboard", pathPrefix: true },
{ path: "./components/automation", pathPrefix: true },
```

> El `pathPrefix: true` (estilo data-table) genera nombres como
> `<BaseDashboardStatCard>`. El `pathPrefix: false` (estilo form) genera
> `<StatCard>` suelto. Decisión abierta en Q-004.

## Diagrama de relaciones

```
┌──────────────────────────────┐
│   @base/ui-app (catalog)     │
│ ┌──────────┐  ┌────────────┐ │
│ │scheduling│  │ dashboard  │ │
│ └────┬─────┘  └─────┬──────┘ │
│      │              │        │
│ ┌────┴─────┐  ┌─────┴────┐   │
│ │  form    │  │automation│   │
│ └────┬─────┘  └─────┬────┘   │
└──────┼──────────────┼────────┘
       │              │
       ▼              ▼
┌──────────────────────────────┐
│      Extensions (front)       │
├──────────────────────────────┤
│ affiliate      → StatCard, LineChart, CronScheduleEditor, FieldRelation │
│ autonomous-agent → CronScheduleEditor, StatCard, TimelineList           │
│ cms            → StatCard, EmptyState, JsonSchemaEditor                 │
│ content-pipeline→ StatCard, DonutChart, ToggleGroup, JsonSchemaEditor   │
│ crm            → StatCard, BarChart, TimelineList, FieldRelation         │
│ stripe         → StatCard, LineChart, RadioCards                         │
│ upload-post    → StatCard, BarChart, WeekdayPicker, TimeWindowPicker     │
└──────────────────────────────┘
```

> Mapping exacto por extensión se detalla en `03-requirements.md` y se
> completa en cada PRD de extensión.

## Decisiones técnicas con trade-offs

### D-01: Charts envuelven `echarts` existente

**Decisión**: `LineChart`, `BarChart`, `DonutChart` son wrappers
declarativos sobre `vue-echarts` (ya en `package.json`).

**Razones**:
- `echarts: 5.5.0` + `vue-echarts: 7.0.3` ya presentes — cero nuevas deps.
- `analytics` ya los usa inline — hay precedente y conocimiento en el
  equipo.
- echarts soporta line/bar/donut/gauge/heatmap/scatter — cubre todos los
  casos del catálogo.

**Alternativas descartadas**:
- `chartjs/vue-chartjs`: requeriría nueva dependencia. echarts ya da.
- `unovis`/`visx`: más modernos pero eco Vue menos maduro y añaden peso.
- Custom SVG: máxima flexibilidad, mínimo peso, pero mantenimiento alto
  y reinventar tooltips/zoom/accesibilidad.

> Ver Q-001 para validar si se prefiere custom SVG para casos simples.

### D-02: CronScheduleEditor genera cron 5-field + preview humano

**Decisión**: el componente emite `string` cron 5-field estándar (`min
hour day-of-month month day-of-week`). Muestra preview humano ("Cada
lunes 09:00") generado por util `cronToHuman.ts`.

**Razones**:
- NestJS `@Cron` ya usa 5-field — compatibilidad directa con backend.
- Backend `AaConfigEntity.researchCron` ya guarda strings 5-field.
- El preview elimina la barrera de aprendizaje sin bloquear power-users.

**Alternativa descartada**:
- Solo UI visual (no cron crudo): rechazado por Q-002 (open).

### D-03: Componentes themeable via DaisyUI

**Decisión**: todos los componentes usan clases DaisyUI existentes
(`stat`, `card`, `badge`, `btn`, `timeline`, `divider`, `tabs`). No
inyectan colores hex; respetan el theme activo (`@nuxtjs/color-mode`).

**Razones**:
- `tailwindcss: ^4.1.3` + `daisyui: ^5.5.19` ya en el stack.
- 7 dashboards existentes ya usan `stat` DaisyUI — consistencia visual.
- Soporte multi-theme heredado sin código extra.

### D-04: Path aliases `@base/ui-app/components/...`

**Decisión**: todas las imports usan `@base/ui-app/components/<cat>/X.vue`.
No barrel `index.ts` (no existe hoy y añadirlo cambia convención).

**Razones**:
- Regla `docs/EXTENSIONS-SYSTEM.md`: extensions importan con `@base/...`.
- El barrel rompería el tree-shaking automático de Nuxt auto-imports.
- Mantiene consistencia con imports actuales de form/data-table.

## Flujo de datos

```
Extension page (e.g. crm/dashboard)
    │
    │ <StatCard :label="..." :value="..." :trend="..." />
    ▼
@base/ui-app/components/dashboard/StatCard.vue
    │
    │ props tipadas de types.ts
    ▼
Render DaisyUI stat + lucide icon + optional NumberFlow anim
```

```
Extension config form (autonomous-agent/configs/create)
    │
    │ <CronScheduleEditor v-model="form.researchCron" :label="..." />
    ▼
@base/ui-app/components/scheduling/CronScheduleEditor.vue
    │
    │ internal: modo UI (simple) ↔ modo crudo (power)
    │ emite string 5-field
    ▼
lib/cronToHuman.ts → preview "Cada lunes a las 09:00"
    │
    ▼
POST /autonomous-agent/configs → AaConfigEntity.researchCron
```

## Componentes afectados

| Path | Cambio |
|------|--------|
| `ui-app/nuxt.config.ts:11` | Añadir 3 entradas a `components` array |
| `ui-app/components/scheduling/*` | Carpeta nueva (3 archivos) |
| `ui-app/components/dashboard/*` | Carpeta nueva (7 archivos) |
| `ui-app/components/automation/*` | Carpeta nueva (4 archivos) |
| `ui-app/components/form/*` | 4 archivos nuevos en carpeta existente |
| `ui-app/pages/app/components/` | 3 demos nuevas (scheduling, dashboard, automation) |