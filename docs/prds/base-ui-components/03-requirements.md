---
doc: base-ui-components/03-requirements
title: "Requirements — FR y NFR por componente"
status: draft
created: 2026-07-07
---

# 03 — Requirements

Convención: FR-NNN por componente (sub-numerados dentro de cada bloque),
NFR globales al final. EARS notation.

---

## Scheduling

### CronScheduleEditor

- **FR-001** THE SYSTEM SHALL exponer un editor visual de cron 5-field con
  4 modos: `every-n-minutes`, `daily-at`, `weekly-on`, `monthly-on`.
- **FR-002** WHEN el usuario selecciona un modo THE SYSTEM SHALL mostrar
  los inputs relevantes (interval minutos / hora / weekdays / día del
  mes) y ocultar los demás.
- **FR-003** THE SYSTEM SHALL emitir `string` cron 5-field estándar vía
  `v-model`.
- **FR-004** THE SYSTEM SHALL mostrar un preview human-readable del
  schedule en español ("Cada lunes a las 09:00", "Días 28-31 a las
  23:00") actualizado en tiempo real.
- **FR-005** IF el usuario activa el toggle "modo avanzado" THEN THE
  SYSTEM SHALL mostrar un `FormInput` crudo para editar cron syntax
  directamente y validar con regex 5-field.
- **FR-006** IF el string entrante no encaja en ningún modo simple THEN
  THE SYSTEM SHALL activar el modo avanzado automáticamente.
- **FR-007** THE SYSTEM SHALL aceptar props `label`, `description`,
  `error`, `required`, `disabled`, `timezone?: 'user' | 'server'`.
- **FR-008** WHEN `timezone === 'user'` THE SYSTEM SHALL mostrar nota
  "Horario de tu navegador (Europe/Madrid)" con offset detectado.
- Props: `modelValue: string`, `label: string`, `description?: string`,
  `error?: string`, `required?: boolean`, `disabled?: boolean`,
  `timezone?: 'user' | 'server'`, `allowAdvanced?: boolean = true`.
- Slots: `hint` (contenido extra bajo el preview).
- **Consumen**: autonomous-agent (4 crons), affiliate (monthly report),
  upload-post (4 crons), storage (file cleanup).

### WeekdayPicker

- **FR-010** THE SYSTEM SHALL renderizar 7 toggles L M X J V S D
  seleccionables independientes (multi-select).
- **FR-011** THE SYSTEM SHALL aceptar `firstDayOfWeek?: 0 | 1` (domingo
  o lunes primero).
- **FR-012** THE SYSTEM SHALL emitir `number[]` (0-6 ISO) vía `v-model`.
- **FR-013** THE SYSTEM SHALL soportar presets vía prop `presets?`:
  `weekdays`, `weekends`, `none`.
- Props: `modelValue: number[]`, `label?: string`, `firstDayOfWeek?: 0|1=1`,
  `presets?: boolean = true`, `disabled?: boolean`.
- **Consumen**: upload-post (snapshot días), CronScheduleEditor (modo
  weekly-on), crm (interaction days).

### TimeWindowPicker

- **FR-020** THE SYSTEM SHALL renderizar dos `FormTime` (start, end) más
  selector de timezone.
- **FR-021** IF `end <= start` THEN THE SYSTEM SHALL mostrar `error` y no
  emitir.
- **FR-022** THE SYSTEM SHALL emitir `{ start: string, end: string,
  timezone: string }` vía `v-model`.
- Props: `modelValue: { start: string; end: string; timezone: string }`,
  `label?: string`, `error?: string`, `disabled?: boolean`.
- **Consumen**: upload-post (queue slots), content-pipeline (publish
  windows), affiliate (report windows).

### KeyValueEditor

- **FR-030** THE SYSTEM SHALL renderizar una lista de pares clave-valor
  editables con add/remove rows.
- **FR-031** THE SYSTEM SHALL aceptar `valueType?: 'string' | 'number' |
  'boolean'` para tipar los valores.
- **FR-032** THE SYSTEM SHALL emitir `Record<string, string | number |
  boolean>` vía `v-model`.
- **FR-033** IF `keyPattern` prop se pasa THEN THE SYSTEM SHALL validar
  cada clave contra el regex y marcar inválidas.
- Props: `modelValue: Record<string, unknown>`, `label?: string`,
  `valueType?: 'string'|'number'|'boolean'='string'`, `keyPattern?:
  string`, `disabled?: boolean`, `maxRows?: number`.
- **Consumen**: content-pipeline (metadata jsonb), stripe (product
  metadata), affiliate (partner metadata).

---

## Dashboard widgets

### StatCard

- **FR-040** THE SYSTEM SHALL renderizar una card de estadística con
  `label`, `value`, `icon` (lucide), `trend?` (number, positivo=verde,
  negativo=rojo), `color?` (DaisyUI variant).
- **FR-041** WHEN `value` es número THE SYSTEM SHALL animar con
  `@number-flow/vue` (count-up).
- **FR-042** THE SYSTEM SHALL aceptar slot `footer` para acciones o
  notas secundarias.
- Props: `label: string`, `value: string | number`, `icon?: Component`,
  `trend?: number`, `color?: 'primary'|'secondary'|'accent'|'info'|
  'success'|'warning'|'error'='primary'`, `loading?: boolean`.
- Slots: `footer`, `prefix`, `suffix`.
- **Consumen**: 7/8 dashboards de extensiones.

### LineChart

- **FR-050** THE SYSTEM SHALL renderizar un line chart declarativo
  envolviendo `vue-echarts` con datos `{ x, y }[]` o series múltiples.
- **FR-051** THE SYSTEM SHALL aceptar `xAxisType?: 'category' | 'time' |
  'value'` y `yAxisType?` análogo.
- **FR-052** THE SYSTEM SHALL aceptar `series: { name: string; data:
  {x:number;y:number}[] }[]` y renderizar una línea por serie.
- **FR-053** THE SYSTEM SHALL respetar el theme DaisyUI activo (color de
  fondo, paleta de líneas).
- **FR-054** WHEN `loading === true` THE SYSTEM SHALL mostrar
  `loading-spinner` de DaisyUI.
- Props: `series: LineSeries[]`, `xAxisType?: 'category'|'time'|'value'`,
  `height?: string='300px'`, `loading?: boolean`, `smooth?: boolean`,
  `area?: boolean`.
- **Consumen**: analytics (visitors), stripe (MRR trend), upload-post
  (impressions time series).

### BarChart

- **FR-060** THE SYSTEM SHALL renderizar un bar chart vertical u
  horizontal con `orientation?: 'vertical' | 'horizontal'`.
- **FR-061** THE SYSTEM SHALL aceptar `categories: string[]` + `series:
  { name; data: number[] }[]`.
- **FR-062** WHEN `stacked === true` THE SYSTEM SHALL apilar las series.
- Props: `categories: string[]`, `series: BarSeries[]`,
  `orientation?: 'vertical'|'horizontal'='vertical'`, `stacked?:
  boolean=false`, `height?: string='300px'`, `loading?: boolean`.
- **Consumen**: crm (clients by status, projects by status),
  affiliate (top partners), upload-post (platform breakdown).

### DonutChart

- **FR-070** THE SYSTEM SHALL renderizar un donut chart con `data: {
  name; value; color? }[]`.
- **FR-071** THE SYSTEM SHALL mostrar leyenda opcional y tooltips al
  hover con porcentaje.
- **FR-072** WHEN `data` está vacío THE SYSTEM SHALL mostrar `EmptyState`
  en lugar del donut.
- Props: `data: DonutSlice[]`, `height?: string='300px'`,
  `showLegend?: boolean=true`, `loading?: boolean`, `centerLabel?:
  string`.
- **Consumen**: content-pipeline (status distribution), stripe (plan
  distribution), cms (post by category).

### TimelineList

- **FR-080** THE SYSTEM SHALL renderizar una lista de eventos
  cronológicos usando `timeline` de DaisyUI.
- **FR-081** THE SYSTEM SHALL aceptar `events: { time: Date | string;
  title: string; description?: string; icon?: Component; color?:
  DaisyVariant }[]`.
- **FR-082** WHEN `events` está vacío THE SYSTEM SHALL mostrar
  `EmptyState`.
- Props: `events: TimelineEvent[]`, `max?: number`, `loading?:
  boolean`.
- **Consumen**: crm (recent interactions), autonomous-agent (recent
  runs), cms (recent posts).

### EmptyState

- **FR-090** THE SYSTEM SHALL renderizar un estado vacío con `icon`,
  `title`, `description`, slot `action`.
- **FR-091** THE SYSTEM SHALL aceptar prop `size?: 'sm' | 'md' | 'lg'`
  para escalado contextual (dentro de tabla vs página completa).
- Props: `icon?: Component`, `title: string`, `description?: string`,
  `size?: 'sm'|'md'|'lg'='md'`.
- Slots: `action`, `default`.
- **Consumen**: todos los dashboards y tablas vacías.

---

## Automation forms

### ToggleGroup

- **FR-100** THE SYSTEM SHALL renderizar un grupo de toggles
  seleccionables (multi o single mode vía `multiple?: boolean`).
- **FR-101** THE SYSTEM SHALL emitir `string[]` (multi) o `string`
  (single) según `multiple`.
- **FR-102** THE SYSTEM SHALL aceptar `options: { value; label; icon?;
  description? }[]` y renderizar cada toggle como botón con icono
  opcional.
- Props: `modelValue: string[] | string`, `options: ToggleOption[]`,
  `multiple?: boolean=true`, `label?: string`, `error?: string`,
  `disabled?: boolean`.
- **Consumen**: content-pipeline (targetPlatforms), upload-post
  (platforms), stripe (features).

### RadioCards

- **FR-110** THE SYSTEM SHALL renderizar opciones como cards
  seleccionables (radio single-select) con icon/título/descripción.
- **FR-111** THE SYSTEM SHALL emitir `string` (value seleccionado) vía
  `v-model`.
- **FR-112** WHEN `selected` prop coincide con una opción THEN THE
  SYSTEM SHALL marcarla visualmente con borde destacado.
- Props: `modelValue: string`, `options: RadioCardOption[]`,
  `label?: string`, `columns?: 1|2|3|4=3`, `disabled?: boolean`,
  `error?: string`.
- **Consumen**: stripe (plan picker), content-pipeline (contentType),
  crm (project type).

### JsonSchemaEditor

- **FR-120** THE SYSTEM SHALL renderizar un editor de JSON estructurado
  guiado por un `schema: ZodSchema` que genera inputs apropiados por
  campo.
- **FR-121** WHEN un campo del schema es `z.object()` anidado THEN THE
  SYSTEM SHALL renderizar sub-form recorriendo recursivamente.
- **FR-122** WHEN un campo es `z.array(z.object())` THEN THE SYSTEM SHALL
  renderizar lista repetible con add/remove rows.
- **FR-123** THE SYSTEM SHALL validar contra el schema y mostrar
  errores por campo vía `error` prop o slot.
- **FR-124** THE SYSTEM SHALL emitir `Record<string, unknown>` validado
  vía `v-model` (sin emitir si hay errores).
- Props: `modelValue: Record<string, unknown>`, `schema: ZodSchema`,
  `label?: string`, `disabled?: boolean`, `collapsed?: boolean`.
- **Consumen**: content-pipeline (affiliateConfig, socialConfig,
  authorPersona), cms (customJsonLd), stripe (product metadata).

### FieldRelation

- **FR-130** THE SYSTEM SHALL renderizar un `FormSearchSelect` que, al
  seleccionar un item, dispara un fetch al `endpoint` declarado para
  auto-fill otros campos del form.
- **FR-131** THE SYSTEM SHALL aceptar prop `relations: { field: string;
  endpoint: string; map: (item: unknown) => unknown }[]` describiendo
  qué campos auto-fill y desde dónde.
- **FR-132** WHEN el usuario selecciona un item THE SYSTEM SHALL emitir
  `select` con el item completo para que el form padre actualice otros
  inputs.
- **FR-133** IF `endpoint` devuelve 404 o error THEN THE SYSTEM SHALL
  mostrar toast vía `vue-sonner` y no romper el form.
- Props: `modelValue: string | number`, `label: string`, `endpoint:
  string`, `options?: { label; value }[]`, `relations?: FieldRelation[]`,
  `error?: string`, `disabled?: boolean`, `placeholder?: string`.
- Emits: `select` (payload: item completo), `update:modelValue`.
- **Consumen**: affiliate (partner → client auto-fill), crm (client →
  projects), content-pipeline (project → ideas).

### NumericStepper

- **FR-015** THE SYSTEM SHALL exponer un input numérico con botones +/−
  y validación de min/max/step.
- **FR-016** WHEN el usuario presiona +/− THE SYSTEM SHALL
  incrementar/decrementar el valor según `step` sin exceder `max` ni
  bajar de `min`.
- **FR-017** WHEN el usuario escribe directamente THE SYSTEM SHALL
  validar `min ≤ valor ≤ max` y mostrar `error` si fuera de rango.
- Props: `modelValue: number`, `min?: number`, `max?: number`,
  `step?: number = 1`, `label?: string`, `description?: string`,
  `error?: string`, `required?: boolean`, `disabled?: boolean`,
  `unit?: string` (ej. "minutos", "días").
- Slots: `hint`.
- **Consumen**: CronScheduleEditor (modo `every-n-minutes`),
  content-pipeline (concurrencia de checks), upload-post (max posts
  per slot).

---

## Requisitos no funcionales (NFR)

### Performance

- **NFR-001** WHILE el dataset de un chart supera 1000 puntos THE SYSTEM
  SHALL usar `echarts` lazy-loading y no bloquear el render inicial.
- **NFR-002** THE SYSTEM SHALL lazy-import `vue-echarts` en
  `LineChart`/`BarChart`/`DonutChart` para no inflar el bundle si no se
  usan.
- **NFR-003** THE SYSTEM SHALL memoizar el parseo `cronToHuman` con
  caché LRU de 100 entradas.

### Accesibilidad

- **NFR-010** THE SYSTEM SHALL proveer `role`, `aria-label` y foco
  visible en todos los componentes interactivos (toggles, radios,
  pickers, editor cron).
- **NFR-011** THE SYSTEM SHALL soportar navegación por teclado en
  `CronScheduleEditor`, `WeekdayPicker`, `ToggleGroup`, `RadioCards`,
  `KeyValueEditor` (Tab, Arrow keys, Enter, Escape — patrón de
  `FormSelect` existente).

### i18n

- **NFR-020** THE SYSTEM SHALL externalizar todos los strings visibles
  vía `vue-i18n` (`$t('base-ui.cron.daily')`, etc.) y proveer claves en
  `src/i18n/` siguiendo el patrón de traducciones existente.
- **NFR-021** THE SYSTEM SHALL respetar el locale activo para nombres
  de días y meses vía `date-fns/locale`.

### Responsive

- **NFR-030** WHILE el viewport < 640px THE SYSTEM SHALL reorganizar
  `StatCard` grid, `RadioCards` a 1 columna, `ToggleGroup` a wrap, y
  charts a 100% width.

### Themeable

- **NFR-040** THE SYSTEM SHALL usar solo clases DaisyUI — sin colores
  hex inline — para soportar theme switching (`@nuxtjs/color-mode`).
- **NFR-041** THE SYSTEM SHALL aceptar `color`/`variant` props
  tipados con las variantes DaisyUI (`primary | secondary | accent |
  neutral | info | success | warning | error`).

### Tipado

- **NFR-050** THE SYSTEM SHALL exportar interfaces en `types.ts` por
  carpeta (`scheduling/types.ts`, `dashboard/types.ts`,
  `automation/types.ts`, `form/types.ts` extendido).
- **NFR-051** THE SYSTEM SHALL usar `import type` para todas las
  interfaces importadas (regla `docs/TYPESCRIPT-GUIDELINES.md`).
- **NFR-052** THE SYSTEM SHALL usar `NullableType<T>` / `MaybeType<T>`
  para props opcionales nuleables (regla TS guidelines).

### Testing

- **NFR-060** THE SYSTEM SHALL tener al menos 1 test Playwright por
  componente cubriendo render básico + interacción primaria.
- **NFR-061** THE SYSTEM SHALL tener demo visual en
  `ui-app/pages/app/components/` por cada categoría nueva
  (scheduling, dashboard, automation).

## Criterios de aceptación globales

- Cada componente pasa `eslint --fix` + `prettier --write` sin warnings.
- `pnpm check-types` pasa en `apps/front`.
- Imports usan `@base/ui-app/components/...` — sin rutas relativas largas.
- `nuxt.config.ts` registra las 3 carpetas nuevas.
- Cada componente aparece en su demo page y renderiza sin errores en dev.