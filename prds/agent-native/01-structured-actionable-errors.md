---
doc: agent-native/01-structured-actionable-errors
title: "Structured Actionable Errors"
status: draft
created: 2026-08-19
priority: P0
---

# PRD 01 — Structured Actionable Errors

## Objetivo

Todo error que genera el spec engine debe devolver JSON structured que un agente de coding pueda parsear para entender qué falló, dónde, por qué, y qué acción correctiva tomar. Esto es la base del auto-fix (PRD 08) y del MCP introspection (PRD 02).

## Problema actual

`SpecErrorReporter` (en `core/spec-engine/spec-error-reporter.ts`) ya deduplica errores por hash y los persiste en `ErrorTrackerService`. Pero el formato del error es para humanos:

```typescript
// ErrorLogEntity actual
{
  message: "Hook task-before-create failed",
  source: "spec-engine/hook",
  stack: "TypeError: Cannot read property 'id' of undefined\n  at ...",
  metadata: { extension: "tasks", resource: "task", hook: "beforeCreate" },
  occurrences: 3,
  resolved: false
}
```

Un agente que recibe esto sabe que algo falló pero NO sabe:
- Qué spec causó el error (qué archivo YAML)
- Qué handler específico falló (ruta al archivo .ts)
- Qué input lo disparó
- Qué se esperaba que pasara
- Qué fix sugerir
- Si es un bug de código o un error de datos

## Diseño

### Nuevo tipo: `ActionableError`

Añadir a `spec.types.ts`:

```typescript
export interface ActionableError {
  // ─── Identificación ───
  id: string;                    // UUID único por ocurrencia
  hash: string;                  // SHA256 para dedup (mismo scheme actual)
  timestamp: string;             // ISO 8601

  // ─── Taxonomía ───
  category: ErrorCategory;       // Clasificación del error
  severity: 'critical' | 'error' | 'warning';

  // ─── Localización (dónde falló) ───
  extension: string;             // ej: "tasks"
  resource: string | null;       // ej: "task" (null si es error de extensión)
  specFile: string;              // ruta relativa: "extensions/tasks/task.spec.yaml"
  operation: string;             // "create" | "update" | "delete" | "list" | "read" | "hook:beforeCreate" | "job:stale-detector" | "webhook:inbound" | "action:assign"

  // ─── Contexto (qué estaba pasando) ───
  input: Record<string, unknown>;  // payload que disparó la operación (sensitive scrubbed)
  userId: number | null;           // usuario autenticado (null si system)
  requestId: string;               // trace ID (correlaciona con spec-trace)

  // ─── Diagnóstico (por qué falló) ───
  message: string;                 // mensaje humano
  technicalMessage: string;        // mensaje técnico exacto
  stack: string;                   // stack trace completo
  handlerFile: string | null;      // ruta al .ts que falló: "extensions/tasks/hooks/task-before-create.ts"
  handlerFunction: string | null;  // función: "default" o "beforeCreate"
  failurePoint: FailurePoint;      // dónde exactamente en el pipeline

  // ─── Acción correctiva (qué hacer) ───
  suggestedFix: SuggestedFix | null;
  relatedSpec: RelatedSpecRef | null;  // referencia a la parte del spec relevante

  // ─── Estado ───
  occurrences: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  resolved: boolean;
}

export type ErrorCategory =
  | 'validation'          // input no pasa validación (cliente)
  | 'hook_failure'        // before/after hook lanzó excepción
  | 'job_failure'         // job cron/interval falló
  | 'webhook_failure'     // handler de webhook falló
  | 'action_failure'      // custom action falló
  | 'permission_denied'   // guard bloqueó acceso (no se persiste como error, solo log)
  | 'not_found'           // recurso no existe (404 — no es bug, pero se trackea para contexto)
  | 'rate_limit'          // throttling activado (429 — no es bug)
  | 'database'            // error de DB (constraint, connection)
  | 'notification'        // email/webhook de notificación falló
  | 'spec_invalid'        // spec YAML mal formado o inválido
  | 'extension_load'      // extensión no carga
  | 'unknown';

export interface FailurePoint {
  layer: 'spec_loader' | 'entity_factory' | 'validation_factory' | 'controller_factory'
       | 'hook_executor' | 'job_runner' | 'webhook_controller' | 'action_factory'
       | 'permission_guard' | 'notification_dispatcher' | 'spec_engine_boot';
  step: string;            // ej: "executing beforeCreate hook"
  rawError: string;        // error original sin procesar
}

export interface SuggestedFix {
  type: 'code_fix' | 'data_fix' | 'spec_fix' | 'config_fix' | 'manual';
  description: string;           // "El handler task-before-create asume que input.assigneeId existe pero llega null. Añadir null check o marcar assigneeId como required en spec."
  targetFile: string | null;     // "extensions/tasks/hooks/task-before-create.ts"
  targetSpec: string | null;     // "extensions/tasks/task.spec.yaml" (si el fix es en spec)
  targetField: string | null;    // "assigneeId" (si es un field-specific fix)
  suggestedCode: string | null;  // snippet de código sugerido (cuando se pueda inferir)
  confidence: 'high' | 'medium' | 'low';
}

export interface RelatedSpecRef {
  specFile: string;
  resource: string;
  field: string | null;
  section: 'fields' | 'permissions' | 'hooks' | 'jobs' | 'notifications' | 'webhooks' | 'actions' | 'seeds';
  lineHint: number | null;  // línea aproximada en el YAML (si se puede inferir)
}
```

### Cambios en SpecErrorReporter

El `SpecErrorReporter` actual recibe `SpecError` y `SpecTrace`. Se extiende para construir `ActionableError`:

```typescript
// core/spec-engine/spec-error-reporter.ts (extender)

export class SpecErrorReporter {
  // ... existente ...

  async report(error: SpecError, trace: SpecTrace): Promise<ActionableError> {
    const hash = computeSpecErrorHash(error.message, error.source, error.stack);
    const actionable = this.buildActionableError(error, trace, hash);
    const persisted = await this.persist(actionable);  // devuelve la entity con occurrences reales

    // Solo abrir GitHub issue en la PRIMERA ocurrencia (occurrences === 1)
    // y si no es permission_denied (ver abajo)
    if (this.isProduction() && persisted.occurrences === 1 && actionable.category !== 'permission_denied') {
      await this.openGitHubIssue(actionable);
    }
    return actionable;
  }

  // permission_denied NO se persiste como error ni abre issue.
  // Es comportamiento normal (403), no un bug. Se loguea como
  // info para auditoría pero no entra en el error tracker.
  private shouldTrackAsError(error: SpecError, trace: SpecTrace): boolean {
    // permission_denied es comportamiento esperado, no un error
    if (trace.layer === 'permission_guard') return false;
    // validation errors de input del usuario tampoco son bugs
    if (trace.layer === 'validation_factory' && this.isClientInputError(error)) return false;
    return true;
  }

  private isClientInputError(error: SpecError): boolean {
    // Errores de validación que vienen del input del usuario (no del código)
    return error.message.includes('expected') ||
           error.message.includes('required') ||
           error.message.includes('invalid') ||
           error.message.includes('must be');
  }

  private buildActionableError(error: SpecError, trace: SpecTrace, hash: string): ActionableError {
    return {
      id: randomUUID(),
      hash,
      timestamp: new Date().toISOString(),
      category: this.categorize(error, trace),
      severity: this.inferSeverity(error, trace),
      extension: trace.extension,
      resource: trace.resource,
      specFile: trace.specFile,
      operation: trace.operation,
      input: this.scrubSensitive(trace.input),
      userId: trace.userId,
      requestId: trace.requestId,
      message: error.message,
      technicalMessage: this.extractTechnical(error),
      stack: error.stack || '',
      handlerFile: trace.handlerFile,
      handlerFunction: trace.handlerFunction,
      failurePoint: {
        layer: trace.layer,
        step: trace.step,
        rawError: error.message,
      },
      suggestedFix: this.inferSuggestedFix(error, trace),
      relatedSpec: this.inferRelatedSpec(error, trace),
      occurrences: 1,
      firstOccurredAt: new Date().toISOString(),
      lastOccurredAt: new Date().toISOString(),
      resolved: false,
    };
  }

  private inferSuggestedFix(error: SpecError, trace: SpecTrace): SuggestedFix | null {
    // ─── Heurísticas por categoría ───

    // validation: "Cannot read property X of undefined" en hook
    // Nota: Node 18+ usa "Cannot read properties of undefined (reading 'X')"
    // Node <18 usa "Cannot read property 'X' of undefined"
    // Hay que detectar ambos formatos
    if (error.message.includes('Cannot read properties of undefined') ||
        error.message.includes('Cannot read property')) {
      // Node 18+: "Cannot read properties of undefined (reading 'assigneeId')"
      // Node <18: "Cannot read property 'assigneeId' of undefined"
      const propMatch = error.message.match(/reading '(\w+)'/) ||
                        error.message.match(/Cannot read property '(\w+)'/);
      const prop = propMatch?.[1] || 'unknown';
      return {
        type: 'spec_fix',
        description: `Handler asume que ${prop} existe pero llega undefined/null. Marcar como required en spec o añadir null check en handler.`,
        targetFile: trace.handlerFile,
        targetSpec: trace.specFile,
        targetField: prop,
        suggestedCode: null,
        confidence: 'medium',
      };
    }

    // database: foreign key violation
    if (error.message.includes('violates foreign key constraint')) {
      return {
        type: 'data_fix',
        description: 'Referencia a entidad que no existe. Verificar que el ID referenciado existe antes de crear.',
        targetFile: null,
        targetSpec: trace.specFile,
        targetField: null,
        suggestedCode: null,
        confidence: 'high',
      };
    }

    // permission: guard denied
    if (trace.layer === 'permission_guard') {
      return {
        type: 'spec_fix',
        description: `Usuario con rol ${trace.userRole} intentó ${trace.operation} en ${trace.resource}. Si debería poder, añadir rol a permissions.${trace.operation} en spec.`,
        targetFile: null,
        targetSpec: trace.specFile,
        targetField: null,
        suggestedCode: null,
        confidence: 'high',
      };
    }

    // hook failure genérico
    if (trace.layer === 'hook_executor') {
      return {
        type: 'code_fix',
        description: `Hook ${trace.step} lanzó excepción. Revisar handler en ${trace.handlerFile}.`,
        targetFile: trace.handlerFile,
        targetSpec: null,
        targetField: null,
        suggestedCode: null,
        confidence: 'low',
      };
    }

    return null;
  }
}
```

### Cambios en SpecTrace

`SpecTrace` (en `spec.types.ts`) ya existe para tracing. Se extiende con campos que alimentan `ActionableError`:

```typescript
export interface SpecTrace {
  requestId: string;
  extension: string;
  resource: string | null;
  specFile: string;
  operation: string;
  // ─── NUEVOS ───
  layer: FailurePoint['layer'];
  step: string;
  input: Record<string, unknown>;
  userId: number | null;
  userRole: string | null;
  handlerFile: string | null;
  handlerFunction: string | null;
}
```

### Cambios en ErrorLogEntity

Añadir columnas para soportar `ActionableError` sin romper el schema existente:

```typescript
// modules/error-tracker/entities/error-log.entity.ts (extender)

@Entity({ name: 'error_logs' })
export class ErrorLogEntity extends EntityRelationalHelper {
  // ... existentes: id, hash, message, source, stack, metadata, occurrences, resolved, resolvedAt, firstOccurredAt, lastOccurredAt ...

  // ─── NUEVOS (nullable para no romper logs existentes) ───
  @Index()
  @Column({ type: 'varchar', nullable: true })
  category: ErrorCategory;

  @Column({ type: 'varchar', nullable: true })
  severity: 'critical' | 'error' | 'warning';

  @Column({ type: 'varchar', nullable: true })
  extension: string;

  @Column({ type: 'varchar', nullable: true })
  resource: string;

  @Column({ type: 'varchar', nullable: true })
  specFile: string;

  @Column({ type: 'varchar', nullable: true })
  operation: string;

  @Column({ type: 'varchar', nullable: true })
  handlerFile: string;

  @Column({ type: 'jsonb', nullable: true })
  failurePoint: { layer: string; step: string; rawError: string };

  @Column({ type: 'jsonb', nullable: true })
  suggestedFix: SuggestedFix | null;

  @Column({ type: 'jsonb', nullable: true })
  relatedSpec: RelatedSpecRef | null;

  @Column({ type: 'varchar', nullable: true })
  requestId: string;

  @Column({ type: 'int', nullable: true })
  userId: number;
}
```

### Migration

```sql
-- Add actionable error columns
ALTER TABLE error_logs ADD COLUMN category VARCHAR(50);
ALTER TABLE error_logs ADD COLUMN severity VARCHAR(10);
ALTER TABLE error_logs ADD COLUMN extension VARCHAR(100);
ALTER TABLE error_logs ADD COLUMN resource VARCHAR(100);
ALTER TABLE error_logs ADD COLUMN specFile VARCHAR(255);
ALTER TABLE error_logs ADD COLUMN operation VARCHAR(100);
ALTER TABLE error_logs ADD COLUMN handlerFile VARCHAR(255);
ALTER TABLE error_logs ADD COLUMN failurePoint JSONB;
ALTER TABLE error_logs ADD COLUMN suggestedFix JSONB;
ALTER TABLE error_logs ADD COLUMN relatedSpec JSONB;
ALTER TABLE error_logs ADD COLUMN requestId VARCHAR(255);
ALTER TABLE error_logs ADD COLUMN userId INT;

CREATE INDEX idx_error_logs_category ON error_logs(category);
CREATE INDEX idx_error_logs_extension ON error_logs(extension);
CREATE INDEX idx_error_logs_requestId ON error_logs(requestId);
```

### Endpoint API

Extender `ErrorTrackerController` para devolver `ActionableError`:

```
GET  /api/v1/error-tracker           → ActionableError[] (con filtros: category, extension, severity, resolved)
GET  /api/v1/error-tracker/:id       → ActionableError (con suggestedFix incluido)
POST /api/v1/error-tracker/:id/fix   → { accepted: boolean, fixId: string }  (PRD 08: aceptar fix sugerido)
```

### Formato de error HTTP

Cuando un error del spec engine llega al cliente, el response HTTP incluye el `ActionableError`:

```json
{
  "error": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "category": "hook_failure",
    "severity": "error",
    "extension": "tasks",
    "resource": "task",
    "operation": "hook:beforeCreate",
    "message": "Hook task-before-create failed: Cannot read property 'assigneeId' of undefined",
    "specFile": "extensions/tasks/task.spec.yaml",
    "handlerFile": "extensions/tasks/hooks/task-before-create.ts",
    "suggestedFix": {
      "type": "spec_fix",
      "description": "Handler asume que assigneeId existe pero llega undefined/null. Marcar como required en spec o añadir null check en handler.",
      "targetFile": "extensions/tasks/hooks/task-before-create.ts",
      "targetSpec": "extensions/tasks/task.spec.yaml",
      "targetField": "assigneeId",
      "confidence": "medium"
    },
    "requestId": "req_abc123"
  }
}
```

## Implementación

### Fase 1: Tipos y persistencia (sin romper nada)

1. Añadir `ActionableError`, `ErrorCategory`, `SuggestedFix`, `RelatedSpecRef`, `FailurePoint` a `spec.types.ts`
2. Extender `SpecTrace` con campos nuevos
3. Extender `ErrorLogEntity` con columnas nuevas (nullable)
4. Crear migration `AddActionableErrorColumns`
5. Extender `SpecErrorReporter.buildActionableError()` con heurísticas básicas
6. No cambiar el flujo existente — solo enriquecer

### Fase 2: Heurísticas de suggestedFix

1. Implementar `inferSuggestedFix()` con las heurísticas del diseño
2. Añadir heurísticas específicas por categoría:
   - `validation`: parsear Zod errors → sugerir fix en spec o en input
   - `hook_failure`: parsear stack → identificar línea del handler
   - `permission_denied`: comparar rol del usuario con permissions del spec
   - `database`: parsear mensaje de Postgres → identificar constraint
3. Testear cada heurística con errores reales del codebase

### Fase 3: Enriquecimiento de traces

Esta es la fase más laboriosa. Cada punto del spec engine que puede fallar debe construir un `SpecTrace` completo. Los archivos que hay que tocar:

| Archivo | layer | Qué añadir |
|---------|-------|------------|
| `hook-executor.ts` | `hook_executor` | trace con handlerFile, handlerFunction, input |
| `spec-job-runner.ts` | `job_runner` | trace con handler, jobName |
| `validation-factory.ts` | `validation_factory` | trace con field que falló, valor recibido |
| `controller-factory.ts` | `controller_factory` | trace con operation, resource |
| `spec-engine-action-factory.ts` | `action_factory` | trace con actionName, handler, input |
| `notification-dispatcher.ts` | `notification_dispatcher` | trace con template, recipient |
| `webhook-controller-factory.ts` | `webhook_controller` | trace con webhookName, handler |
| `spec-engine-boot.ts` | `spec_engine_boot` | trace con extension, specFile |
| `spec-loader.ts` | `spec_loader` | trace con specFile, error de parse |
| `entity-factory.ts` | `entity_factory` | trace con resource, field |
| `role-registry.ts` | `permission_guard` | trace con userRole, operation, resource |

Cada archivo recibe el trace y lo pasa al `SpecErrorReporter.report()` cuando algo falla. Esto no cambia la lógica existente — solo envuelve los catch blocks existentes con construcción de trace.

**Estimación de esfuerzo**: ~11 archivos, ~2-3 cambios por archivo (construir trace en catch, pasar a reporter). No es complejo pero es minucioso.

### Fase 4: Endpoint + scrubbing

1. Extender `ErrorTrackerController` con filtros y formato nuevo
2. Implementar scrubbing de sensitive data en `input`:
   - Reusar `SENSITIVE_KEY_PATTERNS` que ya existe en spec-error-reporter.ts
   - Añadir scrubbing de file/binary payloads: si un campo es `type: file`, el valor se reemplaza por `{ filename: string, scrubbed: true }`
   - Limitar input a primeros 10KB; truncar si excede
3. Asegurar que `suggestedFix.suggestedCode` nunca incluya secrets

## Dependencias

- Ninguna externa nueva. Usa crypto (ya importado), TypeORM (ya usado), NestJS (ya usado).

## Criterios de aceptación

1. Todo error del spec engine genera un `ActionableError` con category, extension, resource, specFile, operation, handlerFile
2. `suggestedFix` se infiere para los 5 patrones más comunes (null access, FK violation, permission denied, hook crash, validation fail)
3. ErrorLogEntity persiste todos los campos nuevos
4. `GET /api/v1/error-tracker` filtra por category, extension, severity, resolved
5. Errors HTTP responses incluyen `requestId` para correlación con traces
6. Sensitive data nunca aparece en `input` ni `suggestedFix`
7. Extensions existentes (CRM, Tasks, CMS) siguen funcionando sin cambios
8. Migration es reversible (down migration limpia columnas nuevas)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Heurísticas de fix generan sugerencias incorrectas | Confidence level siempre presente; agente decide si aplica |
| Stack traces varían entre Node versions | Usar source maps; parsear primer frame del stack |
| Performance de scrubbing en inputs grandes | Limitar input a primeros 10KB; truncar si excede |
| Migration en prod con datos existentes | Columnas nullable; backfill null para existentes |