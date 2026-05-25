# Calendar Component

Calendario agnóstico y configurable con 3 vistas (Mes, Semana, Día), drag & drop con grid snapping, y eventos con metadatos.

## Componentes

| Componente | Descripción |
|-----------|-------------|
| `Calendar.vue` | Orquestador — recibe events, maneja vista actual, navegación |
| `CalendarMonthView.vue` | Grid mensual 7×6 con celdas de día, eventos, "+N más" |
| `CalendarWeekView.vue` | Time grid semanal (7 columnas × 24h) con eventos posicionados absolutamente |
| `CalendarDayView.vue` | Time grid diario (1 columna × 24h) |
| `CalendarEvent.vue` | Chip de evento con drag & drop, ghost visual, click para detalle |
| `CalendarToolbar.vue` | Header con navegación `< Hoy >` y tabs Mes/Semana/Día |
| `useCalendar.ts` | Composable: generación de grids, formato español, navegación |

## Funcionalidades

- **3 vistas**: Mes (grid 7×6), Semana (time grid 7 cols), Día (time grid 1 col)
- **Drag & Drop** con pointer events nativos y umbral de 5px (diferencia clic de drag)
- **Ghost visual** — el evento sigue el cursor con `position: fixed` vía Teleport
- **Drop target highlight** — celda/slot destino se ilumina en azul (`ring-2 ring-primary`)
- **Snap configurable** — default 15 minutos, líneas visuales cada 30 minutos
- **Altura configurable** — prop `height`, default `75vh`
- **Vista inicial configurable** — Mes, Semana o Día
- **"+N más"** en mes → navega a vista Semana en esa fecha
- **Navegación** — `< Hoy >`, botón "Hoy", tabs de vista
- **Modales en demo**: crear evento (título, descripción, todo el día, fecha/hora), detalle evento
- **Recurrencia** — interfaz definida, expandida en backend

## API

### Calendar.vue

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `events` | `CalendarEvent[]` | `[]` | Array de eventos |
| `view` | `'month' \| 'week' \| 'day'` | `'month'` | Vista activa |
| `height` | `string` | `'75vh'` | Altura del calendario |
| `snapMinutes` | `number` | `15` | Intervalo de snap para D&D |
| `firstDayOfWeek` | `number` | `1` | 0=Domingo, 1=Lunes |

| Emit | Payload | Descripción |
|------|---------|-------------|
| `event-click` | `CalendarEvent` | Click en evento |
| `event-create` | `{ start, end, allDay }` | Click en slot vacío |
| `event-drop` | `{ event, newStart, newEnd }` | Evento movido/resizeado |
| `update:view` | `CalendarView` | Cambio de vista |
| `update:current-date` | `Date` | Cambio de fecha |

## Dependencias

- `date-fns` v4 — matemática de fechas, formato
- `@vueuse/core` — `useElementBounding` para hit-testing del grid
- `lucide-vue-next` — iconos
- DaisyUI + Tailwind CSS — estilos

## Demo

Página de ejemplo: `/app/components/calendar-demo`

Acceso desde el menú: **UI App > Components > Calendar**

## Estructura

```
calendar/
├── Calendar.vue
├── CalendarMonthView.vue
├── CalendarWeekView.vue
├── CalendarDayView.vue
├── CalendarEvent.vue
├── CalendarToolbar.vue
├── composables/
│   └── useCalendar.ts
└── types.ts
```

## Arquitectura del Drag & Drop

El D&D usa **pointer events nativos** (no librerías externas) porque requiere **grid snapping** — la posición del drop debe coincidir exactamente con una celda/slot del calendario.

- `CalendarEvent.vue` captura `pointerdown`/`pointermove`/`pointerup`
- Umbral de 5px: <5px = click (abre detalle), >5px = drag
- Ghost: `<Teleport to="body">` con `position: fixed` siguiendo `clientX/clientY`
- Drop target: cada vista trackea el puntero y resalta la celda/slot bajo el cursor
- Snap: `Math.floor(minutes / snapMinutes) * snapMinutes` para anclar a intervalos

## Issue

GitHub issue: [#47 — Componente Calendario](https://github.com/ADCP-dev/foundation/issues/47)
