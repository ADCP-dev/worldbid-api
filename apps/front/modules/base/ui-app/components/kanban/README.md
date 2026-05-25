# Kanban Component

Tablero Kanban tipo Trello agnóstico y configurable para Foundation UI.

## Componentes

| Componente | Descripción |
|-----------|-------------|
| `Kanban.vue` | Orquestador — recibe tasks/states, computa `tasksByState`, renderiza columnas |
| `KanbanColumn.vue` | Columna de estado con `vue-draggable-plus` para D&D cross-column |
| `KanbanCard.vue` | Tarjeta de tarea con checklist, tags, assignee, prioridad, edición inline |
| `KanbanTag.vue` | Badge de etiqueta con color configurable |
| `UserAvatar.vue` | Avatar circular con tooltip hover (nombre/email/rol) |

## Funcionalidades

- **Drag & Drop** entre columnas con `vue-draggable-plus`
- **Checklist interactivo** — toggle items, añadir nuevos (en card y en modal)
- **Edición inline** del título — doble click o icono lápiz
- **Modal editor completo**: título, descripción, etiquetas (FormMultipleSelect), asignado (FormSelect), checklist, chat de comentarios (burbujas DaisyUI), fecha límite, prioridad
- **Columnas dinámicas** — botón "+ Columna" para crear nuevos estados
- **Chat de comentarios** con editar/borrar mensajes, auto-scroll, burbujas DaisyUI
- **Ghost visual** durante drag con highlight azul en celda destino
- **Responsive** — columnas en fila con scroll horizontal

## API

### Kanban.vue

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `tasks` | `KanbanTask[]` | requerido | Array de tareas |
| `states` | `KanbanStateConfig[]` | requerido | Configuración de estados |
| `tagConfig` | `KanbanTagConfig` | opcional | Configuración de renderizado de tags |
| `group` | `string` | `'kanban'` | Nombre del grupo para D&D |

| Emit | Payload | Descripción |
|------|---------|-------------|
| `update:task-state` | `{ taskId, newStateId, oldStateId }` | Tarea movida de columna |
| `create-task` | `stateId` | Crear tarea en columna |
| `update-task-title` | `{ taskId, title }` | Título editado |
| `delete-task` | `taskId` | Eliminar tarea |
| `click-task` | `taskId` | Click en tarjeta |

## Dependencias

- `vue-draggable-plus` — drag & drop
- `lucide-vue-next` — iconos
- DaisyUI + Tailwind CSS — estilos

## Demo

Página de ejemplo: `/app/components/kanban-demo`

Acceso desde el menú: **UI App > Components > Kanban**

## Estructura

```
kanban/
├── Kanban.vue
├── KanbanColumn.vue
├── KanbanCard.vue
├── KanbanTag.vue
├── UserAvatar.vue
└── types.ts
```

## Issue

GitHub issue: [#46 — Componente Kanban](https://github.com/ADCP-dev/foundation/issues/46)
