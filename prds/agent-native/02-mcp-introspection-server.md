---
doc: agent-native/02-mcp-introspection-server
title: "MCP Introspection Server"
status: draft
created: 2026-08-19
priority: P0
---

# PRD 02 — MCP Introspection Server

## Objetivo

Un MCP server que expone la totalidad de Foundation como tools que un agente de coding puede consultar. El agente puede ver toda la app —endpoints, guards, estructura de datos, validaciones, jobs, correos, specs, extensiones, entidades, migraciones— sin leer código fuente. Es la pieza que multiplica la velocidad de programación: el agente opera con contexto completo en lugar de adivinar o greppear.

## Problema actual

Un agente que trabaja en Foundation hoy tiene que:

1. Leer `AGENTS.md` (51KB) para entender el proyecto
2. Greppear `apps/back/src/extensions/` para ver qué extensiones hay
3. Leer cada `extension.manifest.ts` para ver rutas
4. Leer cada `*.spec.yaml` para ver entidades, fields, permissions
5. Leer handlers `.ts` para entender lógica de hooks/actions
6. Leer `apps/back/src/modules/` para entender módulos base
7. Buscar en `docs/` para entender el spec engine
8. Revisar migrations para entender el schema de DB

Cada una de esas operaciones consume tokens y tiempo. Y el agente puede perder contexto entre tantas lecturas. El MCP introspection server consolida todo eso en tools que devuelven JSON structured.

## Diseño

### Arquitectura

```
Agente (Cursor/Claude Code/OpenCode)
    │
    ▼
MCP Server (NestJS module en apps/back)
    │
    ├── SpecEngineIntrospector    → lee specs cargados en runtime
    ├── ExtensionIntrospector     → lee manifests + estructura
    ├── ModuleIntrospector        → lee módulos base (iam, comms, storage, etc.)
    ├── RouteIntrospector         → lee rutas registradas (NestJS router)
    ├── EntityIntrospector        → lee EntitySchemas del spec engine + entidades TypeORM
    ├── JobIntrospector           → lee jobs registrados (BullMQ + spec jobs)
    ├── NotificationIntrospector  → lee notificaciones + templates de email
    ├── MigrationIntrospector     → lee migrations pendientes y aplicadas
    ├── ErrorIntrospector         → lee error_logs con ActionableError
    └── FrontendIntrospector      → lee Nuxt layers + pages + componentes
    │
    ▼
Foundation runtime (NestJS app)
```

Hay dos modos de operación, y cada uno sirve para un caso distinto:

**Modo A: Proceso standalone (stdio, para agentes)**

El MCP server es un proceso Node separado que el agente lanza como child process. No es un módulo NestJS. Lee archivos del repo directamente (specs YAML, manifests, handlers) y se conecta a la DB con su propia conexión read-only. Para estado runtime (job status, errores, migrations pendientes), hace peticiones HTTP a la app Foundation si está corriendo; si no está corriendo, devuelve lo que puede leer de DB/archivos.

```json
// Config del agente (ej: Cursor mcp.json)
{
  "mcpServers": {
    "foundation": {
      "command": "npx",
      "args": ["ts-node", "apps/back/src/mcp/introspection-server.ts"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "FOUNDATION_API_URL": "http://localhost:3010"
      }
    }
  }
}
```

Ventajas: no requiere que la app esté corriendo para introspection estática. El agente lo lanza y funciona.

**Modo B: HTTP endpoint dentro de la app (para debugging y HTTP MCP transport)**

Un módulo NestJS `McpModule` se monta dentro de Foundation y expone:

```
GET  /api/v1/_mcp/tools           → lista tools disponibles
POST /api/v1/_mcp/tools/:name     → ejecuta tool con body JSON
```

Ventajas: acceso al DI container, estado runtime en tiempo real, sin proceso separado.

**Implementación compartida**

Ambos modos comparten los mismos introspectores. Los introspectores se escriben como clases puras que reciben either (a) una conexión DB + path al repo (modo A) o (b) servicios inyectados del DI container (modo B). La lógica de "qué devuelve cada tool" vive en los introspectores, no en el transport.

```
                    ┌─────────────────────┐
                    │  Introspectores     │
                    │  (lógica compartida)│
                    └──────┬──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    Modo A (stdio)             Modo B (HTTP)
    Lee DB + archivos          Usa DI container
    Proceso separado           Dentro de NestJS app
    Para agentes               Para debugging
```

### Protocolo

### Tools que expone

Cada tool devuelve JSON structured. Lista completa:

#### 1. `foundation.list_extensions`

Devuelve todas las extensiones cargadas con metadata completa.

```json
// Response
{
  "extensions": [
    {
      "name": "crm",
      "version": "1.0.0",
      "displayName": "CRM",
      "description": "Client relationship management...",
      "dependencies": [],
      "resources": ["CrmStatus", "CrmOrigin", "CrmClient", "CrmContact", "CrmInteraction", "CrmProject"],
      "routes": [
        { "method": "GET", "path": "crm/clients", "guard": "jwt + RolesGuard(admin,manager,user)" },
        { "method": "POST", "path": "crm/clients", "guard": "jwt + RolesGuard(admin,manager)" },
        ...
      ],
      "customRoles": [],
      "seeds": true,
      "enabled": true
    },
    {
      "name": "tasks",
      "version": "2.0.0",
      "displayName": "Tasks",
      "resources": ["task", "task-comment", "task-attachment"],
      "customRoles": ["manager"],
      ...
    }
  ]
}
```

#### 2. `foundation.get_extension`

Devuelve una extensión completa con todos sus recursos, specs, handlers, y rutas.

Parámetros: `{ "name": "tasks" }`

```json
{
  "name": "tasks",
  "version": "2.0.0",
  "specFiles": [
    "extensions/tasks/tasks.extension.spec.yaml",
    "extensions/tasks/task.spec.yaml",
    "extensions/tasks/task-comment.spec.yaml",
    "extensions/tasks/task-attachment.spec.yaml"
  ],
  "resources": [
    {
      "name": "task",
      "table": "ext_tasks_task",
      "fields": [...],          // ver foundation.get_resource
      "permissions": {...},
      "hooks": [...],
      "jobs": [...],
      "notifications": [...],
      "webhooks": [...],
      "actions": [...],
      "seeds": [...]
    }
  ],
  "handlers": [
    { "type": "hook", "name": "beforeCreate", "file": "extensions/tasks/hooks/task-before-create.ts" },
    { "type": "hook", "name": "afterCreate", "file": "extensions/tasks/hooks/task-after-create.ts" },
    { "type": "hook", "name": "afterUpdate", "file": "extensions/tasks/hooks/task-after-update.ts" },
    { "type": "action", "name": "stats", "file": "extensions/tasks/actions/stats.handler.ts" },
    { "type": "action", "name": "reorder", "file": "extensions/tasks/actions/reorder.handler.ts" },
    ...
  ],
  "manifest": { ... }  // extension.manifest.ts contenido
}
```

#### 3. `foundation.get_resource`

Devuelve un recurso individual con toda su definición del spec.

Parámetros: `{ "extension": "tasks", "resource": "task" }`

```json
{
  "name": "task",
  "table": "ext_tasks_task",
  "displayName": "Task",
  "description": "A kanban task card",
  "timestamps": true,
  "softDelete": true,
  "transactional": true,
  "fields": [
    {
      "name": "title",
      "type": "string",
      "required": true,
      "length": 200,
      "validation": { "min": 2, "max": 200 },
      "isFile": false,
      "isRef": false,
      "isEnum": false,
      "isComputed": false
    },
    {
      "name": "assigneeId",
      "type": "ref",
      "ref": "user",
      "refOnDelete": "SET NULL",
      "nullable": true,
      "index": true,
      "isRef": true,
      "referencedResource": "user"
    },
    {
      "name": "status",
      "type": "enum",
      "required": true,
      "default": "pending",
      "enum": ["pending", "in_progress", "review", "done", "blocked"],
      "index": true,
      "isEnum": true
    },
    {
      "name": "attachment",
      "type": "file",
      "storage": "local",
      "allowedMimes": ["application/pdf", "text/plain"],
      "isFile": true
    },
    {
      "name": "apiKey",
      "type": "password",
      "nullable": true,
      "length": 255,
      "isSensitive": true
    }
  ],
  "permissions": {
    "list": ["admin", "user", "manager"],
    "read": ["admin", "user", "manager"],
    "create": ["admin", "manager"],
    "update": ["admin", "user", "manager"],
    "delete": ["admin"],
    "fields": {
      "position": { "read": ["admin", "manager"], "write": ["admin", "manager"] },
      "apiKey": { "read": ["admin"], "write": ["admin"] }
    },
    "rowLevel": {
      "user": { "filter": "assigneeId == ${user.id}" },
      "manager": { "filter": "assigneeId == ${user.id}" }
    }
  },
  "hooks": [
    { "event": "beforeCreate", "handler": "./hooks/task-before-create.ts" },
    { "event": "afterCreate", "handler": "./hooks/task-after-create.ts" },
    { "event": "afterUpdate", "handler": "./hooks/task-after-update.ts" }
  ],
  "jobs": [
    {
      "name": "stale-tasks-detector",
      "schedule": "interval",
      "value": "60000",
      "handler": "./jobs/stale-tasks-detector.ts",
      "queue": "default",
      "retries": 3,
      "backoff": "exponential"
    }
  ],
  "notifications": [
    {
      "name": "task-assigned",
      "trigger": { "on": "afterCreate", "when": "input.assigneeId != null" },
      "channel": "email",
      "template": "task-assigned",
      "to": "${assignee.email}",
      "subject": "Nueva tarea asignada: ${title}"
    }
  ],
  "webhooks": [
    {
      "name": "stale",
      "path": "tasks/webhooks/stale",
      "method": "POST",
      "auth": "hmac",
      "handler": "./webhooks/stale.handler.ts"
    }
  ],
  "actions": [
    {
      "name": "stats",
      "method": "GET",
      "path": "stats",
      "auth": ["admin", "user", "manager"],
      "handler": "./actions/stats.handler.ts",
      "ui": { "label": "Estadísticas", "icon": "BarChart", "buttonLocation": "header" }
    },
    {
      "name": "assign",
      "method": "POST",
      "path": ":id/assign",
      "auth": ["admin", "manager"],
      "input": [
        { "name": "assigneeId", "type": "ref", "ref": "user", "required": true }
      ],
      "handler": "./actions/assign.handler.ts"
    }
  ],
  "audit": { "operations": ["create", "update", "delete"] },
  "seeds": [...]
}
```

#### 4. `foundation.list_routes`

Devuelve todas las rutas HTTP registradas en la app (espec engine + módulos tradicionales + extensions tradicionales).

Parámetros opcionales: `{ "extension": "tasks", "method": "GET" }`

```json
{
  "routes": [
    {
      "method": "GET",
      "path": "/api/v1/tasks",
      "extension": "tasks",
      "resource": "task",
      "operation": "list",
      "guard": {
        "auth": ["jwt"],
        "roles": ["admin", "user", "manager"],
        "rowLevel": {
          "user": "assigneeId == ${user.id}",
          "manager": "assigneeId == ${user.id}"
        },
        "rateLimit": { "enabled": true, "strategy": "user-or-ip" }
      },
      "permissions": ["admin", "user", "manager"],
      "validation": {
        "query": ["filter", "sort", "page", "limit", "include"],
        "filterableFields": ["status", "priority", "assigneeId", "dueDate"],
        "sortableFields": ["createdAt", "priority", "status"]
      }
    },
    {
      "method": "POST",
      "path": "/api/v1/tasks",
      "extension": "tasks",
      "resource": "task",
      "operation": "create",
      "guard": {
        "auth": ["jwt"],
        "roles": ["admin", "manager"],
        "rateLimit": { "enabled": true, "strategy": "user-or-ip" }
      },
      "permissions": ["admin", "manager"],
      "validation": {
        "body": {
          "title": { "type": "string", "required": true, "min": 2, "max": 200 },
          "status": { "type": "enum", "required": true, "values": ["pending","in_progress","review","done","blocked"], "default": "pending" },
          "assigneeId": { "type": "ref", "ref": "user", "nullable": true }
        }
      },
      "hooks": ["beforeCreate", "afterCreate"]
    },
    {
      "method": "POST",
      "path": "/api/v1/tasks/:id/assign",
      "extension": "tasks",
      "resource": "task",
      "operation": "action:assign",
      "guard": {
        "auth": ["jwt", "api-key"],
        "roles": ["admin", "manager"],
        "rateLimit": { "enabled": true, "strategy": "user-or-ip" }
      },
      "input": {
        "assigneeId": { "type": "ref", "ref": "user", "required": true }
      },
      "handler": "extensions/tasks/actions/assign.handler.ts"
    },
    {
      "method": "POST",
      "path": "/api/v1/auth/login",
      "module": "iam",
      "operation": "login",
      "guard": {
        "auth": ["public"],
        "roles": [],
        "rateLimit": { "enabled": true, "strategy": "ip" }
      },
      "validation": {
        "body": {
          "email": { "type": "string", "required": true, "email": true },
          "password": { "type": "string", "required": true }
        }
      }
    }
  ]
}
```

El campo `guard.auth` es un array de métodos aceptados:
- `["jwt"]` — solo JWT
- `["api-key"]` — solo API key
- `["jwt", "api-key"]` — JWT o API key (cualquiera pasa, como `JwtOrApiKeyGuard`)
- `["public"]` — sin autenticación
- `[]` — nadie puede acceder (deny all)

El campo `guard.roles` es los roles requeridos (checked por `RolesGuard` después de auth). Vacío significa cualquier autenticado.

El campo `guard.rateLimit` refleja la configuración del `UserOrIpThrottlerGuard`. Para endpoints públicos, la estrategia es `ip`; para autenticados, `user-or-ip`.

#### 5. `foundation.get_route`

Devuelve una ruta individual con todo el detalle (guards, validation, hooks, handler).

Parámetros: `{ "method": "POST", "path": "/api/v1/tasks" }`

#### 6. `foundation.list_entities`

Devuelve todas las entidades de DB (spec engine dinámicas + TypeORM tradicionales) con su schema.

```json
{
  "entities": [
    {
      "name": "task",
      "table": "ext_tasks_task",
      "source": "spec_engine",     // "spec_engine" | "traditional"
      "extension": "tasks",
      "columns": [
        { "name": "id", "type": "uuid", "primary": true, "generated": true },
        { "name": "title", "type": "varchar", "length": 200, "nullable": false },
        { "name": "assigneeId", "type": "int", "nullable": true, "references": { "table": "user", "column": "id", "onDelete": "SET NULL" } },
        { "name": "createdAt", "type": "timestamp", "nullable": false },
        { "name": "deletedAt", "type": "timestamp", "nullable": true }
      ],
      "indexes": [
        { "name": "idx_task_status", "columns": ["status"] },
        { "name": "idx_task_assigneeId", "columns": ["assigneeId"] }
      ]
    },
    {
      "name": "user",
      "table": "user",
      "source": "traditional",
      "module": "users",
      "columns": [...]
    }
  ]
}
```

#### 7. `foundation.list_jobs`

Devuelve todos los jobs registrados (spec engine + BullMQ tradicionales).

```json
{
  "jobs": [
    {
      "name": "stale-tasks-detector",
      "source": "spec_engine",
      "extension": "tasks",
      "resource": "task",
      "schedule": "interval",
      "value": "60000",
      "handler": "extensions/tasks/jobs/stale-tasks-detector.ts",
      "queue": "default",
      "retries": 3,
      "backoff": "exponential",
      "lastRun": "2026-08-19T10:00:00Z",
      "lastStatus": "completed",
      "lastError": null
    },
    {
      "name": "email-queue-processor",
      "source": "traditional",
      "module": "communications",
      "schedule": "event-driven",
      "handler": "modules/communications/email-queue/email.processor.ts",
      "queue": "email"
    }
  ]
}
```

#### 8. `foundation.list_notifications`

Devuelve todas las notificaciones configuradas (emails, webhooks, SMS) con sus templates y disparadores.

```json
{
  "notifications": [
    {
      "name": "task-assigned",
      "extension": "tasks",
      "resource": "task",
      "trigger": {
        "on": "afterCreate",
        "when": "input.assigneeId != null"
      },
      "channel": "email",
      "template": "task-assigned",
      "templateFile": "modules/communications/mail/mail-templates/task-assigned.hbs",
      "to": "${assignee.email}",
      "subject": "Nueva tarea asignada: ${title}",
      "triggeredFrom": "spec_engine"
    },
    {
      "name": "welcome-email",
      "module": "iam",
      "trigger": { "on": "afterCreate", "when": "always" },
      "channel": "email",
      "template": "welcome",
      "templateFile": "modules/communications/mail/mail-templates/welcome.hbs",
      "to": "${user.email}",
      "subject": "Bienvenido a ${appName}",
      "triggeredFrom": "traditional"
    }
  ]
}
```

#### 9. `foundation.list_migrations`

Devuelve migrations aplicadas y pendientes.

```json
{
  "applied": [
    { "id": 1, "name": "InitialSchema", "timestamp": "1700000000000", "ranAt": "2026-08-01T10:00:00Z" },
    { "id": 2, "name": "AddTasksExtension", "timestamp": "1700100000000", "ranAt": "2026-08-05T14:00:00Z" }
  ],
  "pending": [
    { "name": "AddActionableErrorColumns", "file": "apps/back/src/migrations/AddActionableErrorColumns.ts" }
  ]
}
```

#### 10. `foundation.get_errors`

Devuelve errores recientes del error tracker (con ActionableError del PRD 01).

Parámetros opcionales: `{ "category": "hook_failure", "extension": "tasks", "resolved": false, "limit": 10 }`

#### 11. `foundation.list_modules`

Devuelve módulos base (no extensions) con sus rutas y entidades.

```json
{
  "modules": [
    {
      "name": "iam",
      "path": "modules/iam/",
      "submodules": ["auth", "session", "api-keys", "roles", "auth-google", "auth-apple", "auth-facebook"],
      "routes": [
        { "method": "POST", "path": "/api/v1/auth/login", "guard": "public" },
        { "method": "POST", "path": "/api/v1/auth/register", "guard": "public" },
        { "method": "GET", "path": "/api/v1/auth/me", "guard": "jwt" },
        ...
      ],
      "entities": ["User", "Role", "Session", "ApiKey"]
    },
    {
      "name": "communications",
      "path": "modules/communications/",
      "submodules": ["mail", "email-queue"],
      "routes": [...],
      "entities": []
    }
  ]
}
```

#### 12. `foundation.search_code`

Búsqueda de texto (keyword search) en el código de Foundation. Usa ripgrep bajo el capó — no es búsqueda semántica, es búsqueda literal rápida. Para búsqueda semántica usar el MCP con pgvector (PRD 06) cuando esté disponible.

Parámetros: `{ "query": "task assigned email notification", "limit": 5 }`

```json
{
  "results": [
    {
      "file": "extensions/tasks/hooks/task-after-create.ts",
      "line": 15,
      "snippet": "await ctx.notify('task-assigned', { assigneeId: input.assigneeId, title: input.title });",
      "relevance": 0.95
    },
    {
      "file": "apps/back/src/core/spec-engine/notification-dispatcher.ts",
      "line": 42,
      "snippet": "class NotificationDispatcher { async dispatch(notification: NotificationSpec, ...) }",
      "relevance": 0.72
    }
  ]
}
```

#### 13. `foundation.get_spec_yaml`

Devuelve el contenido raw de un spec YAML (para cuando el agente necesita ver/editar el spec completo).

Parámetros: `{ "extension": "tasks", "resource": "task" }`

#### 14. `foundation.get_handler_code`

Devuelve el código de un handler específico (hook, action, job, webhook).

Parámetros: `{ "extension": "tasks", "handler": "hooks/task-before-create.ts" }`

#### 15. `foundation.list_frontend_layers`

Devuelve las Nuxt layers configuradas con sus páginas y componentes.

```json
{
  "layers": [
    {
      "name": "crm",
      "path": "modules/crm/",
      "pages": ["crm/index.vue", "crm/clients/[id].vue", "crm/dashboard.vue"],
      "components": ["CrmClientForm.vue", "CrmInteractionList.vue"],
      "composables": ["useCrm.ts"],
      "stores": ["crm.ts"]
    }
  ]
}
```

#### 16. `foundation.get_app_overview`

Devuelve un resumen completo de toda la app en una sola llamada. Es lo primero que un agente debería llamar al empezar a trabajar.

```json
{
  "appName": "foundation",
  "version": "1.0.0",
  "extensions": ["crm", "tasks", "cms", "stripe", "affiliate", "upload-post"],
  "modules": ["iam", "users", "billing", "communications", "storage", "translations", "error-tracker", "app-settings"],
  "totalRoutes": 87,
  "totalEntities": 23,
  "totalJobs": 5,
  "totalNotifications": 12,
  "totalMigrations": 45,
  "pendingMigrations": 1,
  "unresolvedErrors": 3,
  "specEngineVersion": "2.0.0",
  "extensionsByType": {
    "specDriven": ["tasks"],
    "traditional": ["crm", "cms", "stripe", "affiliate", "upload-post"]
  }
}
```

## Implementación

### Estructura de archivos

```
apps/back/src/mcp/
├── introspection-server.ts        ← Entry point MCP server
├── mcp.module.ts                  ← NestJS module
├── introspectors/
│   ├── spec-engine.introspector.ts
│   ├── extension.introspector.ts
│   ├── module.introspector.ts
│   ├── route.introspector.ts
│   ├── entity.introspector.ts
│   ├── job.introspector.ts
│   ├── notification.introspector.ts
│   ├── migration.introspector.ts
│   ├── error.introspector.ts
│   └── frontend.introspector.ts
└── tools/
    ├── list-extensions.tool.ts
    ├── get-extension.tool.ts
    ├── get-resource.tool.ts
    ├── list-routes.tool.ts
    ├── get-route.tool.ts
    ├── list-entities.tool.ts
    ├── list-jobs.tool.ts
    ├── list-notifications.tool.ts
    ├── list-migrations.tool.ts
    ├── get-errors.tool.ts
    ├── list-modules.tool.ts
    ├── search-code.tool.ts
    ├── get-spec-yaml.tool.ts
    ├── get-handler-code.tool.ts
    ├── list-frontend-layers.tool.ts
    └── get-app-overview.tool.ts
```

### Dependencia con spec engine

Los introspectores leen del runtime del spec engine, no de archivos. Esto significa:

- `SpecEngineIntrospector` inyecta `SpecLoader` (que ya tiene los specs parseados en memoria)
- `EntityIntrospector` inyecta los `EntitySchema` dinámicos registrados por `EntityFactory`
- `RouteIntrospector` usa el NestJS DI para obtener los controllers registrados
- `JobIntrospector` inyecta `SpecJobRunner` y BullMQ queues

Para módulos tradicionales (no spec engine), los introspectores leen:
- `ExtensionLoader` para ver qué extensiones tradicionales hay
- `Module` metadata de NestJS para rutas
- TypeORM metadata para entidades

### Dependencia MCP SDK

Usar `@modelcontextprotocol/sdk` (paquete oficial npm). El MCP server usa el protocolo MCP estándar:

```typescript
// introspection-server.ts (esqueleto)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'foundation-introspection',
  version: '1.0.0',
}, {
  capabilities: { tools: {} }
});

// Registrar cada tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'foundation.list_extensions', description: '...', inputSchema: {...} },
    { name: 'foundation.get_extension', description: '...', inputSchema: {...} },
    // ... todas las tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'foundation.list_extensions':
      return await extensionIntrospector.listExtensions();
    case 'foundation.get_resource':
      return await specEngineIntrospector.getResource(args.extension, args.resource);
    // ...
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Montaje

El MCP server se puede montar de dos formas:

**Opción A: Proceso separado (recomendado para agentes)**

```bash
# El agente lanza esto como child process
npx ts-node apps/back/src/mcp/introspection-server.ts
```

Se conecta a la DB directamente (read-only) y lee archivos del repo. No necesita que la app NestJS esté corriendo. Más simple para agentes.

**Opción B: HTTP endpoint dentro de la app**

```
GET /api/v1/_mcp/tools          → lista tools
POST /api/v1/_mcp/tools/:name   → ejecuta tool
```

Útil para debugging y para agentes que soportan HTTP MCP transport.

Se implementan ambas. Opción A para agentes, Opción B para debugging.

### Performance

- `get_app_overview` debe responder en <100ms (es un count + aggregate)
- `list_routes` debe responder en <200ms (hay ~87 rutas)
- `get_resource` debe responder en <50ms (ya está en memoria en SpecLoader)
- `search_code` debe responder en <500ms (usa ripgrep bajo el capó)

Para no escanear archivos en cada llamada, los introspectores cachean en memoria con TTL de 5 minutos. El cache se invalida cuando se reload el spec engine.

## Criterios de aceptación

1. Las 16 tools están implementadas y devuelven JSON structured
2. `foundation.get_app_overview` responde en <100ms
3. Un agente puede descubrir todas las rutas, entidades, guards, validaciones, jobs, y notificaciones sin leer código fuente
4. `foundation.list_routes` incluye guards con roles, rowLevel filters, y validación de body/query
5. `foundation.get_resource` incluye fields con tipos, permissions, hooks, jobs, notifications, webhooks, actions
6. `foundation.search_code` usa ripgrep para búsqueda rápida en el repo
7. El MCP server funciona con Cursor, Claude Code, y OpenCode
8. Extensions tradicionales (CRM, CMS, Stripe) aparecen igual que las spec-driven (Tasks)
9. El cache de introspectores se invalida cuando se reload el spec engine

## Dependencias

- `@modelcontextprotocol/sdk` — npm package oficial MCP
- `ripgrep` — para search_code (ya instalado en el sistema)
- Sin dependencias con PRD 01 (funciona independiente, pero se enriquece con ActionableError si PRD 01 está implementado)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| MCP SDK cambia API | Pin version; el protocolo MCP es estable |
| NestJS DI no accesible desde proceso separado | Opción A lee DB + archivos directamente; Opción B usa DI |
| Cache stale tras cambios en spec | Listener en SpecLoader para invalidar cache |
| search_code consume mucho I/O | Limitar a apps/back + apps/front; excluir node_modules, dist, .git |
| MCP server expone info sensible | get_handler_code scrubba secrets; API keys nunca en responses |