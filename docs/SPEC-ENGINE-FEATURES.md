# Spec Engine — 10 Features Avanzadas

> Las 10 features que llevan el spec engine de "demo interesante" a "producto real".

---

## 1. Filtros y ordenación en findAll

Sin esto no hay admin panel usable. Los campos se marcan como filterable/sortable en la spec:

```yaml
fields:
  - name: status
    type: enum
    enum: [pending, in_progress, done]
    ui:
      filterable: true
      sortable: true
      filterType: select

  - name: priority
    type: enum
    enum: [low, medium, high, urgent]
    ui:
      filterable: true
      sortable: true

  - name: createdAt
    type: datetime
    ui:
      sortable: true
      filterable: true
      filterType: dateRange
```

Uso:
```
GET /api/v1/tasks?filter[status]=pending,in_progress&sort=-createdAt,priority
```

Solo campos con `filterable: true` aceptan filtros. Solo campos con `sortable: true` aceptan sort. Prevención de SQL injection: nombres de campos validados contra spec.

## 2. Acciones custom (non-CRUD endpoints)

CRUD no cubre "asignar task", "duplicar cliente", "archivar proyecto":

```yaml
actions:
  - name: assign
    method: POST
    path: ':id/assign'
    auth: [admin]
    input:
      - name: assigneeId
        type: ref
        ref: user
        required: true
    handler: ./actions/assign.handler.ts
    ui:
      label: Asignar
      icon: UserPlus
      buttonLocation: row      # row | bulk | header

  - name: bulk-assign
    method: POST
    path: 'bulk/assign'
    auth: [admin]
    input:
      - name: taskIds
        type: json
        required: true
      - name: assigneeId
        type: ref
        ref: user
        required: true
    handler: ./actions/bulk-assign.handler.ts
    ui:
      label: Asignar selección
      icon: Users
      buttonLocation: bulk

  - name: export-csv
    method: GET
    path: 'export/csv'
    auth: [admin]
    handler: ./actions/export.handler.ts
    ui:
      label: Exportar CSV
      icon: Download
      buttonLocation: header
```

Handler:
```typescript
export default async function assign(
  entityId: number,
  input: { assigneeId: number },
  ctx: HookContext,
): Promise<Record<string, unknown>> {
  const taskRepo = ctx.getRepository('task');
  const task = await taskRepo.findOne({ where: { id: entityId } });
  if (!task) ctx.abort('Task not found');
  await taskRepo.update(entityId, input);
  return task;
}
```

Frontend (SpecDataTable) renderiza botones desde `ui.buttonLocation`.

## 3. State machine para enums

Valida transiciones de estado:

```yaml
fields:
  - name: status
    type: enum
    enum: [pending, in_progress, review, done, blocked]
    stateMachine:
      transitions:
        - { from: pending, to: in_progress, roles: [admin, user] }
        - { from: in_progress, to: review, roles: [admin, user] }
        - { from: review, to: done, roles: [admin] }
        - { from: blocked, to: pending, roles: [admin] }
        - { from: done, to: in_progress, roles: [admin] }  # reopen
      ui:
        showTransitionButtons: true
```

El engine valida en beforeUpdate:
- Si `from → to` no está en transitions → 400 `Invalid state transition`
- Si el user no tiene el rol permitido → 403

## 4. ?include= relations

Evita N+1 queries:

```yaml
fields:
  - name: assigneeId
    type: ref
    ref: user
    includeable: true        # se puede pedir con ?include=assignee
```

```
GET /tasks/1?include=assignee,comments
→ {
  id: 1,
  title: "Fix bug",
  assigneeId: 42,
  assignee: { id: 42, firstName: "Adrián", email: "..." },
  comments: [{ id: 1, content: "Working on it" }]
}
```

Solo relations de campos con `includeable: true` se aceptan.

## 5. Audit log

```yaml
audit: true
# o granular:
audit:
  operations: [create, update, delete]
  fields: [status, assigneeId, priority]
  exclude: [metadata]
```

El engine crea `ext_<resource>_audit` con: id, entityId, operation, field, oldValue, newValue, userId, timestamp.

`GET /api/v1/tasks/:id/audit` devuelve el historial.

## 6. Acciones programadas por entidad

```yaml
scheduledActions:
  - name: reminder-3-days-before
    trigger: dueDate         # campo de la entity
    offset: -3d              # 3 días antes
    handler: ./actions/send-reminder.handler.ts
    cancelOnUpdate: true     # si la entity cambia, reprogramar
```

El engine programa un BullMQ delayed job. Si `cancelOnUpdate`, cancela el job anterior y reprograma.

## 7. Campos computados

```yaml
fields:
  - name: commentCount
    type: computed
    compute:
      type: count
      relation: task-comment
      foreignKey: taskId
    ui:
      display: text
      sortable: true

  - name: isOverdue
    type: computed
    compute:
      type: expression
      expression: 'dueDate != null && dueDate < now() && status != done'
    ui:
      display: badge
      colors: { true: '#ef4444', false: '#22c55e' }

  - name: fullName
    type: computed
    compute:
      type: template
      template: '${firstName} ${lastName}'
```

Los campos computados no se almacenan en DB. Se calculan en runtime en la response.

## 8. Webhooks salientes (subscriptions)

```yaml
outboundWebhooks:
  - name: task-events
    events: [task.created, task.updated, task.deleted]
    subscriptionModel: dynamic
```

- `POST /api/v1/tasks/webhooks/subscribe` — registro de webhook URL
- Cuando un evento ocurre, POST a todas las URLs suscritas
- HMAC signature en cada envío
- SSRF protection (private IPs bloqueadas)

## 9. Soft delete con restore

```yaml
softDelete: true
# el engine añade automáticamente:
# POST /tasks/:id/restore → undoes soft delete
# GET /tasks?deleted=true → ver eliminados (admin only)
```

## 10. Import/export CSV

```yaml
importConfig:
  format: csv
  mapping: { Titulo: title, Estado: status }
  uniqueKey: title        # si existe, actualizar
  handler: ./import/task-import.handler.ts

exportConfig:
  format: csv
  fields: [id, title, status, priority, assigneeId, dueDate]
  handler: ./export/task-export.handler.ts
```

- `POST /api/v1/tasks/import` — acepta CSV, valida, crea/actualiza
- `GET /api/v1/tasks/export?format=csv` — genera CSV

---

## Archivos creados

| Archivo | Feature | Líneas |
|---|---|---|
| `spec-engine-state-machine.ts` | State machine | 50 |
| `spec-engine-audit.ts` | Audit log | 260 |
| `spec-engine-computed.ts` | Computed fields | 330 |
| `spec-engine-io.ts` | Import/export | 280 |
| `spec-engine-action-factory.ts` | Custom actions | 640 |
| `spec-engine-scheduled-actions.ts` | Scheduled actions | 400 |
| `spec-engine-outbound-webhooks.ts` | Outbound webhooks | 590 |

## Tipos añadidos a spec.types.ts

```typescript
// Nuevos en FieldSpec
compute?: ComputeSpec;          // campos computados
stateMachine?: StateMachineSpec; // transiciones de estado
includeable?: boolean;          // ?include= relations

// Nuevos en FieldUISpec
filterable?: boolean;
sortable?: boolean;
filterType?: 'text' | 'select' | 'dateRange' | 'boolean';

// Nuevos en ResourceSpec
actions?: ActionSpec[];
audit?: AuditSpec | boolean;
scheduledActions?: ScheduledActionSpec[];
outboundWebhooks?: OutboundWebhookSpec[];
importConfig?: ImportSpec;
exportConfig?: ExportSpec;

// Nuevos en FieldType
'computed'
```