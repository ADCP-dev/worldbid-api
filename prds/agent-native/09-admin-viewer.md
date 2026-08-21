---
doc: agent-native/09-admin-viewer
title: "Admin Viewer — Pantallas para el dueño de la app"
status: draft
created: 2026-08-19
priority: P1
---

# PRD 09 — Admin Viewer

## Objetivo

Pantallas en el frontend Nuxt que permiten al dueño de la app (tú o el cliente) ver todo lo que el MCP expone a los agentes, pero en formato humano. Stack traces navegables, overview de la app, error detail con suggestedFix, trace del pipeline, auto-fix history. Una fuente de verdad (MCP HTTP endpoints), dos consumidores (agente via MCP JSON, humano via Nuxt UI).

## Problema actual

El ErrorDashboard existente (`modules/base/error-tracker/components/ErrorDashboard.vue`) muestra:
- Tabla plana: Last Occurred, Source, Message, Occurrences, Status
- Modal con stack trace como texto raw en `mockup-code`
- Metadata como JSON raw en un `<pre>`
- Sin filtros por categoría, extensión, o severidad
- Sin suggestedFix, sin trace, sin overview de la app
- Sin syntax highlighting en stack traces
- Sin navegación entre errores relacionados

Es suficiente para "saber que algo falló" pero no para diagnosticar o entender la app.

## Diseño

### Arquitectura: una fuente, dos consumidores

```
MCP Introspection Server (PRD 02)
    │
    ├── Mode A (stdio JSON)  → Agente (Cursor, Claude Code, OpenCode)
    │
    └── Mode B (HTTP JSON)   → Admin Viewer (Nuxt frontend)
                                  │
                                  ├── /admin/errors         → Error dashboard
                                  ├── /admin/errors/:id     → Error detail + trace + fix
                                  ├── /admin/errors/:id/trace → Trace viewer
                                  ├── /admin/overview       → App overview
                                  ├── /admin/extensions     → Extension explorer
                                  ├── /admin/extensions/:name → Extension detail
                                  ├── /admin/routes         → Route explorer
                                  ├── /admin/auto-fix       → Auto-fix history
                                  └── /admin/specs          → Spec YAML viewer
```

El frontend consume los endpoints HTTP del MCP Mode B (`/api/v1/_mcp/tools/:name`). No hay endpoints separados para la UI — los mismos que usa el agente, pero renderizados en Vue.

### Páginas

Todas las páginas usan `middleware: ['auth', 'admin']` (solo admin puede ver el admin viewer). Heredan el layout `default` con el sidebar existente.

#### 1. `/admin/overview` — App Overview

La primera pantalla que ve el admin. Resumen completo de la app en una sola vista.

```
┌──────────────────────────────────────────────────────────┐
│  Foundation — Overview                                    │
│                                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │    6    │ │   87    │ │   23    │ │    5    │         │
│  │ Extens. │ │ Routes  │ │ Entit.  │ │  Jobs   │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │   12    │ │   45    │ │    1    │ │    3    │         │
│  │ Notif.  │ │ Migrat. │ │ Pending │ │ Errors  │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                            │
│  Extensions                           Modules              │
│  ┌──────────┐ ┌──────────┐           ┌──────────┐         │
│  │ ● tasks  │ │   crm    │           │   iam    │         │
│  │ v2.0.0   │ │ v1.0.0   │           │  users   │         │
│  │ spec     │ │ trad.    │           │  comms   │         │
│  └──────────┘ └──────────┘           │ storage  │         │
│  ┌──────────┐ ┌──────────┐           │  trans.  │         │
│  │   cms    │ │  stripe  │           │  errors  │         │
│  └──────────┘ └──────────┘           └──────────┘         │
│                                                            │
│  Recent Errors (top 5)                                    │
│  ┌──────────────────────────────────────────────────┐     │
│  │ ● hook_failure  tasks/task  3x  2 min ago  View →│     │
│  │ ● database      crm/client 1x  1 hour ago View → │     │
│  │ ● notification  tasks      2x  3 hours ago View →│     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

Datos: `foundation.get_app_overview` + `foundation.get_errors` (limit 5, unresolved).

#### 2. `/admin/errors` — Error Dashboard

Reemplaza el ErrorDashboard actual. Filtros por categoría, extensión, severidad, estado.

```
┌──────────────────────────────────────────────────────────┐
│  Errors                                            [Clear]│
│                                                            │
│  Filters: [Category ▾] [Extension ▾] [Severity ▾] [Status]│
│                                                            │
│  ┌──┬────────────┬──────────┬──────────┬────┬────────┐    │
│  │  │ Category   │ Extension│ Message  │ Occ│ Severity│   │
│  ├──┼────────────┼──────────┼──────────┼────┼────────┤    │
│  │🔴│hook_failure│ tasks    │ Cannot.. │ 3x │ error  │    │
│  │🟡│database    │ crm      │ FK viol.. │ 1x │ warning│    │
│  │🔴│notification│ tasks    │ SMTP ti.. │ 2x │ error  │    │
│  │⚫│permission  │ crm      │ User ro.. │ 5x │ info   │    │
│  └──┴────────────┴──────────┴──────────┴────┴────────┘    │
│                                                            │
│  🔴 = unresolved error   🟡 = unresolved warning          │
│  ⚫ = not tracked (permission/validation, log only)       │
│  🟢 = resolved                                            │
│                                                            │
│  Click row → /admin/errors/:id                            │
└──────────────────────────────────────────────────────────┘
```

Datos: `foundation.get_errors` con filtros.

#### 3. `/admin/errors/:id` — Error Detail + Stack Trace Viewer + Fix

La pantalla más importante. Reemplaza el modal actual con una página completa.

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Errors                                          │
│                                                            │
│  hook_failure  ● error  tasks/task  hook:beforeCreate     │
│  "Cannot read properties of undefined (reading 'assignee  │
│  ')"                                                      │
│                                                            │
│  ┌─────────────────┬──────────────────────────────────┐   │
│  │ Occurrences: 3  │ First: Aug 19, 14:23             │   │
│  │ Last: 14:25     │ Request ID: req_abc123           │   │
│  │ User: #42       │ Handler: task-before-create.ts   │   │
│  └─────────────────┴──────────────────────────────────┘   │
│                                                            │
│  ┌─── Tabs ───────────────────────────────────────────┐   │
│  │ [Stack Trace] [Pipeline Trace] [Fix] [Spec] [Raw] │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ═══ Stack Trace Tab ═════════════════════════════════════ │
│                                                            │
│  TypeError: Cannot read properties of undefined           │
│  (reading 'assigneeId')                                    │
│      at default (extensions/tasks/hooks/                  │
│  →       task-before-create.ts:15:22)                     │
│      at HookExecutor.executeBeforeCreate (                │
│        core/spec-engine/hook-executor.ts:87:12)           │
│      at SpecDynamicController.create (                    │
│        core/spec-engine/controller-factory.ts:198:5)      │
│                                                            │
│  ┌─ Click en frame → abre archivo ─────────────────────┐  │
│  │  extensions/tasks/hooks/task-before-create.ts:15    │  │
│  │                                                      │  │
│  │  12  export default async function beforeCreate(    │  │
│  │  13    input: Record<string, unknown>,              │  │
│  │  14    ctx: HookContext                              │  │
│  │  15) {                                               │  │
│  │  16  const assignee = await ctx.userService.findOne │  │
│  │  17    (input.assigneeId);  ← input.assigneeId is   │  │
│  │  18                            undefined             │  │
│  │  19  await ctx.notify('task-assigned', {             │  │
│  │  20    assigneeId: input.assigneeId,                 │  │
│  │  21    title: input.title,                           │  │
│  │  22  });                                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ═══ Pipeline Trace Tab ═════════════════════════════════  │
│                                                            │
│  Request: req_abc123  Duration: 45ms                      │
│                                                            │
│  auth ────pass─── (12ms)  jwt, roles: [admin, manager]    │
│    │                                                       │
│  validation ──pass── (3ms)  title: ok, status: ok, ...    │
│    │                                                       │
│  beforeHook ──FAIL── (30ms) ✗ task-before-create.ts       │
│    │                   Cannot read properties of undef    │
│    ✗                     (reading 'assigneeId')           │
│  db ────skipped───                                        │
│  afterHook ──skipped──                                    │
│  notifications ──skipped──                                │
│  response ────500───                                      │
│                                                            │
│  ═══ Fix Tab ════════════════════════════════════════════  │
│                                                            │
│  Suggested Fix (confidence: medium)                       │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Type: spec_fix                                      │   │
│  │ Description: Handler asume que assigneeId existe    │   │
│  │ pero llega undefined/null. Marcar como required en  │   │
│  │ spec o añadir null check en handler.                │   │
│  │                                                      │   │
│  │ Target: extensions/tasks/task.spec.yaml             │   │
│  │ Field: assigneeId                                    │   │
│  │                                                      │   │
│  │ [Apply Fix]  [Create PR]  [Dismiss]                 │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Auto-fix history for this error:                         │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Aug 19, 14:20 — applied — spec_fix (high)           │   │
│  │   → commit a1b2c3d "fix(auto): hook_failure..."    │   │
│  │ Aug 19, 14:25 — error recurred → escalated to manual│   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ═══ Spec Tab ══════════════════════════════════════════  │
│                                                            │
│  Related spec: extensions/tasks/task.spec.yaml            │
│  Section: fields                                           │
│                                                            │
│  fields:                                                   │
│    - name: assigneeId         ← this field                │
│      type: ref                                            │
│      ref: user                                            │
│      nullable: true          ← should be false?           │
│      refOnDelete: SET NULL                                │
│      index: true                                          │
│                                                            │
│  ═══ Raw Tab ═══════════════════════════════════════════  │
│                                                            │
│  Full ActionableError JSON (collapsible)                  │
└──────────────────────────────────────────────────────────┘
```

Datos: `foundation.get_errors` (single) + `foundation.get_route` (para pipeline info) + spec YAML via `foundation.get_spec_yaml`.

### Stack Trace Viewer

El stack trace no es texto raw. Se parsea y se renderiza como frames navegables:

```vue
<!-- components/StackTraceViewer.vue -->
<script setup lang="ts">
const props = defineProps<{ stack: string }>();

interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  isAppCode: boolean;  // true si es código de Foundation, false si es node_modules
}

// Parsear stack trace en frames
const frames = computed<StackFrame[]>(() => {
  return props.stack
    .split('\n')
    .filter(line => line.trim().startsWith('at '))
    .map(line => {
      const match = line.match(/at (\S+) \((.+):(\d+):(\d+)\)/);
      if (!match) return null;
      const [, functionName, file, lineNum, col] = match;
      return {
        functionName,
        file,
        line: parseInt(lineNum),
        column: parseInt(col),
        isAppCode: !file.includes('node_modules'),
      };
    })
    .filter(Boolean) as StackFrame[];
});

const selectedFrame = ref<StackFrame | null>(null);
const frameContent = ref<string | null>(null);

async function loadFrame(frame: StackFrame) {
  selectedFrame.value = frame;
  // Usar MCP tool foundation.get_handler_code o leer archivo directamente
  const response = await $fetch(`/api/v1/_mcp/tools/foundation.get_handler_code`, {
    method: 'POST',
    body: { file: frame.file },
  });
  frameContent.value = response.content;
}
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="(frame, i) in frames"
      :key="i"
      class="flex items-start gap-2 p-2 rounded hover:bg-base-200 cursor-pointer"
      :class="{ 'bg-primary/10': selectedFrame === frame }"
      @click="loadFrame(frame)"
    >
      <span class="text-base-content/40 font-mono text-sm">{{ i + 1 }}</span>
      <div class="flex-1">
        <span class="font-mono text-sm" :class="frame.isAppCode ? 'text-error' : 'text-base-content/60'">
          {{ frame.functionName }}
        </span>
        <span class="font-mono text-xs text-base-content/50 ml-2">
          {{ frame.file }}:{{ frame.line }}:{{ frame.column }}
        </span>
      </div>
      <span v-if="frame.isAppCode" class="badge badge-error badge-xs">app</span>
    </div>

    <!-- Frame content preview -->
    <div v-if="frameContent && selectedFrame" class="mt-4 bg-neutral rounded-box p-4 max-h-96 overflow-y-auto">
      <div class="text-xs text-base-content/60 mb-2">
        {{ selectedFrame.file }}:{{ selectedFrame.line }}
      </div>
      <pre class="font-mono text-sm text-neutral-content"><code>{{ frameContent }}</code></pre>
    </div>
  </div>
</template>
```

### Pipeline Trace Viewer

Renderiza el `SpecTrace` del error como un timeline visual del pipeline:

```vue
<!-- components/PipelineTraceViewer.vue -->
<script setup lang="ts">
const props = defineProps<{ trace: SpecTrace }>();

interface TraceStage {
  name: string;
  status: 'pass' | 'fail' | 'skipped';
  duration: number;
  detail: Record<string, unknown>;
}

const stages = computed(() => props.trace.stages || []);

const statusColor: Record<string, string> = {
  pass: 'text-success',
  fail: 'text-error',
  skipped: 'text-base-content/40',
};

const statusIcon: Record<string, string> = {
  pass: '✓',
  fail: '✗',
  skipped: '○',
};
</script>

<template>
  <div class="space-y-0">
    <div v-for="stage in stages" :key="stage.name" class="flex items-start gap-3 py-2">
      <!-- Status icon -->
      <span class="font-mono text-lg" :class="statusColor[stage.status]">
        {{ statusIcon[stage.status] }}
      </span>

      <!-- Stage info -->
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm font-bold">{{ stage.name }}</span>
          <span class="font-mono text-xs text-base-content/50">{{ stage.duration }}ms</span>
        </div>
        <div v-if="stage.detail" class="text-xs text-base-content/60 mt-1">
          {{ JSON.stringify(stage.detail) }}
        </div>
        <div v-if="stage.status === 'fail'" class="text-error text-sm mt-1">
          {{ stage.detail?.error || 'Failed' }}
        </div>
      </div>
    </div>
  </div>
</template>
```

### Extension Explorer

#### 4. `/admin/extensions` — Lista de extensiones

```
┌──────────────────────────────────────────────────────────┐
│  Extensions                                                │
│                                                            │
│  ┌──────────────┬────────┬─────────┬────────┬──────────┐  │
│  │ Name         │ Type   │ Version │ Routes │ Resources│  │
│  ├──────────────┼────────┼─────────┼────────┼──────────┤  │
│  │ tasks        │ spec   │ 2.0.0   │   12   │    3     │  │
│  │ crm          │ trad.  │ 1.0.0   │   24   │    6     │  │
│  │ cms          │ trad.  │ 1.0.0   │   18   │    4     │  │
│  │ stripe       │ trad.  │ 1.0.0   │   15   │    3     │  │
│  │ affiliate    │ trad.  │ 1.0.0   │    8   │    2     │  │
│  │ upload-post  │ trad.  │ 1.0.0   │    6   │    1     │  │
│  └──────────────┴────────┴─────────┴────────┴──────────┘  │
│                                                            │
│  Click row → /admin/extensions/:name                      │
└──────────────────────────────────────────────────────────┘
```

#### 5. `/admin/extensions/:name` — Extension detail

Muestra todo lo que `foundation.get_extension` devuelve: recursos, campos, permisos, hooks, jobs, notificaciones, webhooks, actions, handlers. Renderizado en secciones colapsables.

### Route Explorer

#### 6. `/admin/routes` — Todas las rutas

Tabla con: method, path, extension/module, operation, auth, roles, rowLevel. Filtros por método, extensión.

### Auto-Fix History

#### 7. `/admin/auto-fix` — Historial de auto-fixes

```
┌──────────────────────────────────────────────────────────┐
│  Auto-Fix History                                          │
│                                                            │
│  ┌──────────┬──────────┬──────────┬────────┬──────────┐   │
│  │ Time     │ Error    │ Fix Type │ Status │ Confidence│  │
│  ├──────────┼──────────┼──────────┼────────┼──────────┤   │
│  │ 14:20    │ hook_... │ spec_fix │ applied│ high     │   │
│  │ 13:05    │ database │ data_fix │ pr_cre │ medium   │   │
│  │ 12:30    │ permiss. │ spec_fix │ skipped│ low      │   │
│  └──────────┴──────────┴──────────┴────────┴──────────┘   │
│                                                            │
│  Click row → /admin/auto-fix/:id                          │
│  Shows: changes (diff), test result, PR link              │
└──────────────────────────────────────────────────────────┘
```

### Spec Viewer

#### 8. `/admin/specs` — Spec YAML viewer

Lista todos los spec YAML con syntax highlighting. Click en uno → editor viewer con los campos, permisos, hooks, etc. renderizados en secciones colapsables + el YAML raw.

## Implementación

### Estructura de archivos

```
apps/front/modules/base/admin-viewer/
├── nuxt.config.ts
├── plugins/
│   └── nav.ts                    ← añade items al sidebar
├── composables/
│   └── useMcp.ts                 ← wrapper para MCP HTTP endpoints
├── pages/
│   └── admin/
│       ├── overview.vue          ← /admin/overview
│       ├── errors.vue            ← /admin/errors
│       ├── errors/
│       │   └── [id].vue          ← /admin/errors/:id
│       ├── extensions.vue        ← /admin/extensions
│       ├── extensions/
│       │   └── [name].vue        ← /admin/extensions/:name
│       ├── routes.vue            ← /admin/routes
│       ├── auto-fix.vue          ← /admin/auto-fix
│       ├── auto-fix/
│       │   └── [id].vue          ← /admin/auto-fix/:id
│       └── specs.vue             ← /admin/specs
└── components/
    ├── StackTraceViewer.vue      ← stack trace navegable
    ├── PipelineTraceViewer.vue   ← trace del pipeline visual
    ├── ErrorFilters.vue          ← filtros del error dashboard
    ├── ExtensionCard.vue         ← card de extensión en overview
    ├── GuardBadge.vue            ← badge de guard (auth + roles)
    ├── DiffViewer.vue            ← diff de cambios de auto-fix
    └── SpecYamlViewer.vue        ← spec YAML con syntax highlight
```

### useMcp composable

Wrapper que llama los MCP HTTP endpoints:

```typescript
// composables/useMcp.ts
export function useMcp() {
  const call = async (toolName: string, args?: Record<string, unknown>) => {
    return await $fetch(`/api/v1/_mcp/tools/${toolName}`, {
      method: 'POST',
      body: args || {},
    });
  };

  return {
    getOverview: () => call('foundation.get_app_overview'),
    getErrors: (params) => call('foundation.get_errors', params),
    listExtensions: () => call('foundation.list_extensions'),
    getExtension: (name) => call('foundation.get_extension', { name }),
    getResource: (ext, res) => call('foundation.get_resource', { extension: ext, resource: res }),
    listRoutes: (params) => call('foundation.list_routes', params),
    getRoute: (method, path) => call('foundation.get_route', { method, path }),
    listJobs: () => call('foundation.list_jobs'),
    listNotifications: () => call('foundation.list_notifications'),
    listMigrations: () => call('foundation.list_migrations'),
    listModules: () => call('foundation.list_modules'),
    getSpecYaml: (ext, res) => call('foundation.get_spec_yaml', { extension: ext, resource: res }),
    getHandlerCode: (file) => call('foundation.get_handler_code', { file }),
    searchCode: (query, limit) => call('foundation.search_code', { query, limit }),
  };
}
```

### Reemplazo del ErrorDashboard existente

El `modules/base/error-tracker/pages/admin/errors.vue` actual se reemplaza por el nuevo `admin-viewer/pages/admin/errors.vue`. El componente `ErrorDashboard.vue` se elimina y su funcionalidad se migra al nuevo Admin Viewer con StackTraceViewer y filtros.

### Navegación

Añadir al sidebar existente (via plugin `nav.ts`):

```typescript
// plugins/nav.ts
export default defineNuxtPlugin(() => {
  // Añadir items al menú de admin
  useNavStore().addSection('admin', [
    { label: 'Overview', icon: 'LayoutDashboard', to: '/admin/overview' },
    { label: 'Errors', icon: 'AlertCircle', to: '/admin/errors', badge: 'errorCount' },
    { label: 'Extensions', icon: 'Boxes', to: '/admin/extensions' },
    { label: 'Routes', icon: 'Route', to: '/admin/routes' },
    { label: 'Auto-Fix', icon: 'Wrench', to: '/admin/auto-fix' },
    { label: 'Specs', icon: 'FileCode', to: '/admin/specs' },
  ]);
});
```

### Stack trace parser

El parser de stack traces maneja ambos formatos de Node:

```typescript
// utils/stack-trace-parser.ts
interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  isAppCode: boolean;
  isInternal: boolean;
}

export function parseStackTrace(stack: string): StackFrame[] {
  return stack
    .split('\n')
    .filter(line => line.trim().startsWith('at '))
    .map(line => {
      // Formato: "at FunctionName (file:line:col)"
      // Formato: "at file:line:col" (sin nombre de función)
      const match = line.match(/at (?:(\S+)\s+\()?(.+):(\d+):(\d+)\)?/);
      if (!match) return null;

      const [, functionName, file, lineNum, col] = match;
      return {
        functionName: functionName || '<anonymous>',
        file,
        line: parseInt(lineNum),
        column: parseInt(col),
        isAppCode: !file.includes('node_modules') && !file.includes('internal/'),
        isInternal: file.includes('internal/'),
      };
    })
    .filter(Boolean) as StackFrame[];
}
```

Frames de `node_modules` o `internal/` se muestran colapsados por defecto. Solo se expanden los frames de código de Foundation.

## Criterios de aceptación

1. `/admin/overview` muestra el resumen completo de la app en una sola vista
2. `/admin/errors` tiene filtros por categoría, extensión, severidad, estado
3. `/admin/errors/:id` muestra 5 tabs: Stack Trace, Pipeline Trace, Fix, Spec, Raw
4. StackTraceViewer parsea frames y permite click para ver el código del archivo
5. PipelineTraceViewer muestra el pipeline auth→validation→hooks→db→notifications con status y duration
6. Fix tab muestra suggestedFix con botones Apply/Create PR/Dismiss
7. Auto-fix history muestra changes como diff visual
8. `/admin/extensions` lista todas las extensiones con tipo (spec/traditional)
9. `/admin/extensions/:name` muestra recursos, campos, permisos, hooks, jobs, notificaciones
10. `/admin/routes` lista todas las rutas con guard structured (auth, roles, rowLevel)
11. Todas las páginas consumen los mismos endpoints HTTP del MCP (Mode B)
12. El ErrorDashboard anterior se reemplaza completamente
13. Solo admin puede acceder (middleware auth + admin)
14. Stack traces de node_modules se muestran colapsados por defecto

## Dependencias

- PRD 02 (MCP Introspection Server) — Mode B HTTP endpoints. Sin esto no hay datos que mostrar
- PRD 01 (Actionable Errors) — sin esto, los errores no tienen category, suggestedFix, trace
- PRD 08 (Auto-Fix) — sin esto, no hay auto-fix history ni Fix tab
- Sin dependencias de npm nuevas — usa Nuxt, Vue, DaisyUI (ya instalados)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| MCP HTTP endpoints no devuelven todo lo que la UI necesita | Añadir tools al MCP según sea necesario; la UI y el MCP se desarrollan juntos |
| Stack trace parser no maneja todos los formatos | Testear con errores reales de Node 18+ y 20+; fallback a texto raw si parse falla |
| Error dashboard reemplaza el existente y rompe permisos | Migrar gradualmente: nuevo dashboard en /admin/errors-new, luego reemplazar |
| Performance: overview hace muchas llamadas MCP | Cache en frontend (TanStack Query con staleTime 30s); una llamada get_app_overview aggrega todo |