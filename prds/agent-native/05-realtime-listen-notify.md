---
doc: agent-native/05-realtime-listen-notify
title: "Realtime via Postgres LISTEN/NOTIFY"
status: draft
created: 2026-08-19
priority: P2
---

# PRD 05 — Realtime via Postgres LISTEN/NOTIFY

## Objetivo

Añadir realtime a Foundation usando Postgres LISTEN/NOTIFY + WebSocket gateway. Las apps de cliente (CRM con updates en vivo, chat, notificaciones push) necesitan realtime. Se usa Postgres nativo en lugar de añadir Redis pub/sub o un servicio externo.

## Diseño

### Arquitectura

```
Cliente (Nuxt/Vue)
    │ WebSocket
    ▼
RealtimeGateway (NestJS WebSocket gateway)
    │ LISTEN
    ▼
Postgres (NOTIFY en triggers)
    ▲
    │ NOTIFY (después de INSERT/UPDATE/DELETE)
Spec Engine (controller-factory)
```

### Flujo

1. Spec engine materializa un recurso con `realtime: true` en el spec
2. EntityFactory crea un trigger de Postgres que ejecuta `NOTIFY` después de INSERT/UPDATE/DELETE
3. RealtimeGateway mantiene conexiones WebSocket con clientes
4. RealtimeGateway hace `LISTEN` en el canal del recurso
5. Cuando un cambio ocurre, Postgres notifica al gateway
6. Gateway propaga el cambio a los clientes subscriptos

### Spec: declaración de realtime

En `spec.types.ts`, añadir a `ResourceSpec`:

```typescript
export interface RealtimeSpec {
  events: ('insert' | 'update' | 'delete')[];  // qué eventos emitir
  channel?: string;                              // nombre del canal (default: resource name)
  payload?: ('full' | 'diff' | 'id');            // qué enviar al cliente (default: 'id')
}

export interface ResourceSpec {
  // ... existente ...
  realtime?: RealtimeSpec;
}
```

En el spec YAML:

```yaml
resources:
  - name: task
    table: ext_tasks_task
    realtime:
      events: [insert, update, delete]
      channel: tasks
      payload: full        # envía la entidad completa
```

### Trigger de Postgres

Cuando `realtime` está declarado, `EntityFactory` crea un trigger:

```sql
-- Generado automáticamente por EntityFactory
-- IMPORTANTE: excluir campos marcados como password/secret del payload NOTIFY
-- El EntityFactory consulta el spec y solo incluye campos seguros.
-- INSERT y UPDATE: NEW está disponible
-- DELETE: solo OLD está disponible (NEW es NULL)
CREATE OR REPLACE FUNCTION notify_tasks() RETURNS trigger AS $$
DECLARE
  payload jsonb;
  entity_id uuid;
  safe_data jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    entity_id := OLD.id;
    payload := jsonb_build_object(
      'event', TG_OP,
      'resource', 'task',
      'id', entity_id,
      'data', null
    );
  ELSE
    entity_id := NEW.id;
    -- to_jsonb(NEW) incluye TODOS los campos, incluidos password/apiKey.
    -- El EntityFactory genera la lista de campos seguros en el trigger SQL.
    -- Para esta tabla, los campos seguros son: id, title, description, status,
    -- priority, assigneeId, reporterId, dueDate, position, createdAt, updatedAt.
    -- Campos EXCLUIDOS del NOTIFY: apiKey, attachment (binario), metadata (puede contener PII).
    safe_data := jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'status', NEW.status,
      'priority', NEW.priority,
      'assigneeId', NEW.assigneeId,
      'reporterId', NEW.reporterId,
      'dueDate', NEW.dueDate,
      'position', NEW.position,
      'createdAt', NEW.createdAt,
      'updatedAt', NEW.updatedAt
    );

    payload := jsonb_build_object(
      'event', TG_OP,
      'resource', 'task',
      'id', entity_id,
      'data', safe_data
    );
  END IF;

  PERFORM pg_notify('tasks', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_realtime_notify
  AFTER INSERT OR UPDATE OR DELETE ON ext_tasks_task
  FOR EACH ROW EXECUTE FUNCTION notify_tasks();
```

Nota crítica: el EntityFactory genera la lista de campos seguros consultando el spec. Los campos `type: password`, `type: secret`, y `type: file` se excluyen del payload NOTIFY. Los campos `type: json` se incluyen con un warning en runtime (pueden contener PII). El generador de triggers construye el `jsonb_build_object` con la lista explícita de campos seguros.

Para `payload: 'id'` (todos los eventos, solo ID):

```sql
CREATE OR REPLACE FUNCTION notify_tasks_id() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tasks', jsonb_build_object(
    'event', TG_OP,
    'resource', 'task',
    'id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Para `payload: 'diff'` (solo UPDATE envía diff; INSERT envía full; DELETE envía solo ID):

```sql
CREATE OR REPLACE FUNCTION notify_tasks_diff() RETURNS trigger AS $$
DECLARE
  changes jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Solo campos que cambiaron: keys en NEW cuyo valor difiere de OLD
    SELECT jsonb_object_agg(key, value) INTO changes
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(OLD) -> key IS DISTINCT FROM to_jsonb(NEW) -> key;

    PERFORM pg_notify('tasks', jsonb_build_object(
      'event', TG_OP,
      'resource', 'task',
      'id', NEW.id,
      'changes', COALESCE(changes, '{}'::jsonb)
    )::text);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM pg_notify('tasks', jsonb_build_object(
      'event', TG_OP,
      'resource', 'task',
      'id', NEW.id,
      'data', to_jsonb(NEW)
    )::text);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('tasks', jsonb_build_object(
      'event', TG_OP,
      'resource', 'task',
      'id', OLD.id
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Nota: `pg_notify` tiene un límite de 8KB en el payload. Para entidades grandes con `payload: 'full'`, usar `payload: 'id'` y que el cliente haga un GET para obtener la entidad completa. El EntityFactory emite un warning en runtime si la entidad tiene más de 10 campos o campos text/json grandes y se declara `payload: 'full'`.

### RealtimeGateway (NestJS WebSocket)

```typescript
// core/realtime/realtime.gateway.ts
@WebSocketGateway({ namespace: '/realtime', cors: true })
export class RealtimeGateway {
  @WebSocketServer() server: Server;

  private channels = new Map<string, Set<string>>(); // channel → client IDs

  async handleConnection(client: Socket) {
    // Autenticar con JWT del query param
    const token = client.handshake.query.token;
    const user = await this.authService.verify(token);
    if (!user) { client.disconnect(); return; }
    client.data.user = user;
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { channel: string }) {
    // Verificar permisos: el usuario puede ver este recurso?
    const channel = payload.channel;
    if (!this.canSubscribe(client.data.user, channel)) {
      client.emit('error', { message: 'Permission denied' });
      return;
    }
    client.join(channel);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { channel: string }) {
    client.leave(payload.channel);
  }

  // Called by Postgres LISTEN handler
  broadcastChange(channel: string, event: RealtimeEvent) {
    this.server.to(channel).emit('change', event);
  }
}
```

### PostgresListener (conexión LISTEN)

```typescript
// core/realtime/postgres-listener.ts
@Injectable()
export class PostgresListener implements OnModuleInit {
  private client: pg.Client;

  constructor(
    private gateway: RealtimeGateway,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Crear conexión dedicada para LISTEN (no usa el pool)
    this.client = new pg.Client(this.configService.get('DATABASE_URL'));
    await this.client.connect();

    // Escuchar todos los canales de recursos con realtime
    const channels = await this.getRealtimeChannels();
    for (const channel of channels) {
      await this.client.query(`LISTEN "${channel}"`);
    }

    this.client.on('notification', (msg) => {
      const event = JSON.parse(msg.payload);
      this.gateway.broadcastChange(msg.channel, event);
    });
  }

  async addChannel(channel: string) {
    await this.client.query(`LISTEN "${channel}"`);
  }

  async removeChannel(channel: string) {
    await this.client.query(`UNLISTEN "${channel}"`);
  }
}
```

### Permission check en subscribe

Cuando un cliente se subscribe a un canal, el gateway verifica permisos:

```typescript
private canSubscribe(user: User, channel: string): boolean {
  // channel "tasks" → recurso "task"
  const resource = this.channelToResource(channel);
  const spec = this.specLoader.getResourceSpec(resource);
  if (!spec?.permissions?.read) return false;

  const userRoles = user.roles;
  const allowedRoles = spec.permissions.read;
  return userRoles.some(role => allowedRoles.includes(role));
}
```

### Permission filtering en broadcast

El checkeo en subscribe valida que el usuario puede ver el recurso. Pero NO valida row-level por evento. Un usuario subscripto al canal `tasks` con rowLevel `assigneeId == ${user.id}` NO debería recibir eventos de tasks que no son suyas.

Hay dos estrategias, se elige por configuración del RealtimeSpec:

```typescript
export interface RealtimeSpec {
  events: ('insert' | 'update' | 'delete')[];
  channel?: string;
  payload?: ('full' | 'diff' | 'id');
  // ─── NUEVO ───
  rowLevelFiltering?: 'client' | 'server';
  // 'client': el servidor envía todos los eventos; el cliente filtra
  // 'server': el servidor filtra antes de enviar (más seguro, más CPU)
  // Default: 'server' si hay rowLevel declarado, 'client' si no
}
```

**Modo 'server' (default cuando hay rowLevel)**

El gateway evalúa el rowLevel filter contra el payload del evento antes de enviarlo:

```typescript
broadcastChange(channel: string, event: RealtimeEvent) {
  const resource = this.channelToResource(channel);
  const spec = this.specLoader.getResourceSpec(resource);

  for (const client of this.server.sockets.adapter.rooms[channel] || []) {
    const user = client.data.user;
    if (!user) continue;

    // Si el evento incluye 'data' (payload full), evaluar rowLevel
    if (event.data && spec?.permissions?.rowLevel?.[user.roles[0]]) {
      const filter = spec.permissions.rowLevel[user.roles[0]].filter;
      // 'assigneeId == ${user.id}' → evaluar contra event.data
      if (!this.evaluateRowLevel(filter, event.data, user)) {
        continue;  // no enviar a este cliente
      }
    }

    // Field-level: scrub campos que el usuario no puede leer
    if (event.data && spec?.permissions?.fields) {
      event.data = this.scrubFields(event.data, spec.permissions.fields, user.roles);
    }

    client.emit('change', event);
  }
}
```

**Modo 'client' (cuando no hay rowLevel o entidades pequeñas)**

El servidor envía todos los eventos. El cliente decide si mostrarlos. Menos seguro (el cliente ve datos que no debería), pero menos CPU en el servidor. Solo usar si no hay rowLevel declarado.

**Casos sin payload 'data'**

Si `payload: 'id'`, el servidor no puede evaluar rowLevel (no tiene la entidad). En ese caso:
- El gateway hace un `SELECT` rápido para obtener la entidad y evaluar rowLevel, O
- El cliente hace el GET del ID, y si recibe 403, ignora el evento

La primera opción es más segura pero añade un query por evento. La segunda es más eficiente pero el cliente recibe IDs que no puede ver.

Recomendación: si hay rowLevel, usar `payload: 'full'` + modo 'server'. Si no hay rowLevel, `payload: 'id'` + modo 'client' es seguro.

```typescript
// apps/front/composables/useRealtime.ts
export function useRealtime(channel: string, callback: (event: RealtimeEvent) => void) {
  const socket = useWebSocket('/realtime', { query: { token: useAuth().token } });

  onMounted(() => {
    socket.emit('subscribe', { channel });
    socket.on('change', (event) => {
      if (event.resource === channel) callback(event);
    });
  });

  onUnmounted(() => {
    socket.emit('unsubscribe', { channel });
  });
}
```

Uso en una página de CRM:

```vue
<script setup>
useRealtime('tasks', (event) => {
  if (event.event === 'insert') tasksStore.add(event.data);
  if (event.event === 'update') tasksStore.update(event.id, event.data);
  if (event.event === 'delete') tasksStore.remove(event.id);
});
</script>
```

## Implementación

### Fase 1: Spec + triggers

1. Añadir `RealtimeSpec` a `spec.types.ts`
2. Extender `EntityFactory` para crear triggers de Postgres cuando `realtime` está declarado
3. Generar SQL de triggers en `migration-generator.ts`

### Fase 2: Gateway + listener

1. Implementar `RealtimeGateway` con WebSocket
2. Implementar `PostgresListener` con conexión dedicada
3. Integrar con NestJS module (`RealtimeModule`)
4. Autenticación JWT en WebSocket connection

### Fase 3: Frontend

1. Composable `useRealtime` en Nuxt
2. Integración con TanStack Query (invalidar queries en realtime events)
3. Actualización de stores Pinia

### Fase 4: Permission filtering

1. Verificar permisos en subscribe
2. Para rowLevel: filtrar eventos por rowLevel filter antes de enviar al cliente
3. Para fieldLevel: scrub campos que el usuario no puede ver

## Criterios de aceptación

1. Un recurso con `realtime: { events: [insert, update, delete] }` genera triggers de Postgres automáticamente
2. Un cliente conectado via WebSocket recibe cambios en tiempo real (<100ms)
3.Clientes sin permiso de read no pueden subscribirse al canal
4. rowLevel: un usuario solo recibe eventos de rows que puede ver
5. fieldLevel: campos no permitidos se scrubban del payload
6. `payload: 'id'` envía solo el ID (cliente hace fetch completo)
7. `payload: 'full'` envía la entidad completa
8. Múltiples clientes conectados simultáneamente sin degradación
9. El PostgresListener reconecta automáticamente si pierde la conexión

## Dependencias

- `pg` (npm) — para conexión dedicada LISTEN (no usa TypeORM pool)
- `socket.io` o `ws` — para WebSocket gateway (NestJS ya lo soporta)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| LISTEN/NOTIFY pierde eventos si listener cae | Reconexión automática + replay desde lastSeen ID |
| Payload grande excede 8KB de pg_notify | Usar payload: 'id' para entidades grandes; cliente hace fetch |
| Muchos triggers ralentizan writes | Solo crear triggers si realtime está declarado |
| WebSocket scaling horizontal | Para un solo servidor basta; si escala, usar Redis adapter |