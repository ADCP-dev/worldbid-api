# Webhooks — Standard for External Integrations

Webhooks allow the platform to **push real-time event notifications** to external systems (e.g. Zapier, N8N, Slack, custom services) without those systems needing to poll the API.

> **Summary:** When something happens inside the app (e.g. an incident is created), the platform makes an HTTP `POST` request to a URL configured by the user, containing a JSON payload describing the event.

---

## Concepts

| Term | Description |
|---|---|
| **Event** | Something that happened: `incident.created`, `user.registered`, etc. |
| **Webhook endpoint** | The external URL that receives the `POST` request |
| **Payload** | JSON body sent to the endpoint describing the event |
| **Signature** | HMAC-SHA256 signature to verify authenticity |
| **Delivery** | One attempt to `POST` an event to an endpoint |
| **Retry** | Automatic re-delivery if the endpoint fails |

---

## Event Naming Convention

Events follow a `resource.action` dot-notation:

```
incident.created
incident.updated
incident.resolved
user.registered
user.updated
property.created
```

---

## Standard Payload Shape

Every event payload follows the same envelope:

```json
{
  "id": "evt_01HZ3KF9GWBMX72A4N8DTRQ5C6",
  "event": "incident.created",
  "createdAt": "2025-07-01T10:30:00.000Z",
  "data": {
    "id": 123,
    "title": "Water leak in unit 4B",
    "status": "PENDIENTE",
    "urgency": "HIGH",
    "property": { "id": 7, "name": "Edificio Central" },
    "createdBy": { "id": 42, "email": "tenant@example.com" }
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique event ID (ULID/UUID) for idempotency |
| `event` | string | Event name (`resource.action`) |
| `createdAt` | ISO 8601 | When the event was triggered |
| `data` | object | The relevant resource payload |

---

## Backend Implementation Standard

### 1. Module Structure

```
src/modules/webhooks/
├── domain/
│   └── webhook-subscription.ts     # Endpoint URL + events + secret
├── dto/
│   ├── create-webhook.dto.ts
│   └── webhook-payload.dto.ts
├── infrastructure/
│   ├── entities/webhook-subscription.entity.ts
│   └── webhook-subscription.repository.ts
├── webhooks.controller.ts
├── webhooks.service.ts             # dispatch(), verify(), retry()
└── webhooks.module.ts
```

### 2. Webhook Subscription Entity

```typescript
// domain/webhook-subscription.ts
export class WebhookSubscription {
  id: number;
  url: string;                  // Destination URL
  secret: string;               // HMAC signing secret (hashed at rest)
  events: string[];             // ['incident.created', 'incident.resolved']
  isActive: boolean;
  userId: number;               // The user who owns this subscription
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. REST Endpoints (CRUD)

All endpoints require **JWT authentication**. Users manage only their own subscriptions.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/webhooks` | List subscriptions for current user |
| `POST` | `/v1/webhooks` | Create a new subscription |
| `PATCH` | `/v1/webhooks/:id` | Update URL or subscribed events |
| `DELETE` | `/v1/webhooks/:id` | Delete a subscription |
| `POST` | `/v1/webhooks/:id/test` | Send a test ping to the endpoint |

#### Create payload

```json
{
  "url": "https://hooks.example.com/my-handler",
  "events": ["incident.created", "incident.resolved"],
  "secret": "my-signing-secret"
}
```

### 4. Dispatching Events

Call `WebhooksService.dispatch()` inside the relevant service when an event occurs:

```typescript
// src/modules/incidents/incidents.service.ts
import { WebhooksService } from '@webhooks/webhooks.service';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentRepository: IncidentRepository,
    private readonly webhooksService: WebhooksService, // inject
  ) {}

  async create(dto: CreateIncidentDto, userId: number) {
    const incident = await this.incidentRepository.create({ ...dto, userId });

    // Fire-and-forget webhook dispatch (non-blocking)
    void this.webhooksService.dispatch('incident.created', incident);

    return incident;
  }
}
```

### 5. WebhooksService Core Logic

```typescript
// webhooks.service.ts
@Injectable()
export class WebhooksService {
  async dispatch(event: string, data: unknown): Promise<void> {
    // 1. Find all active subscriptions listening to this event
    const subs = await this.subscriptionRepo.findByEvent(event);

    // 2. Build the payload envelope
    const payload = {
      id: generateEventId(),         // ULID or UUID
      event,
      createdAt: new Date().toISOString(),
      data,
    };

    // 3. Send to each endpoint (in parallel, non-blocking)
    await Promise.allSettled(
      subs.map((sub) => this.deliver(sub, payload)),
    );
  }

  private async deliver(
    sub: WebhookSubscription,
    payload: Record<string, unknown>,
    attempt = 1,
  ) {
    const body = JSON.stringify(payload);
    const signature = this.sign(body, sub.secret);

    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event as string,
          'X-Webhook-ID': payload.id as string,
        },
        body,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt < 3) {
        // Exponential backoff: 5s, 25s
        const delay = 5_000 * attempt ** 2;
        setTimeout(() => this.deliver(sub, payload, attempt + 1), delay);
      }
    }
  }

  private sign(body: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }
}
```

---

## Signature Verification (Receiver Side)

External systems **must verify** the `X-Webhook-Signature` header to ensure the request is genuine:

### Node.js example

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expBuffer);
}

// Express/NestJS handler
app.post('/my-handler', (req, res) => {
  const rawBody = JSON.stringify(req.body);
  const sig = req.headers['x-webhook-signature'] as string;

  if (!verifyWebhook(rawBody, sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;
  console.log(`Received event: ${event}`, data);
  res.sendStatus(200);
});
```

### Python example

```python
import hashlib, hmac

def verify_webhook(body: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## Headers Sent with Every Delivery

| Header | Example value | Description |
|---|---|---|
| `Content-Type` | `application/json` | Always JSON |
| `X-Webhook-Signature` | `sha256=abc123...` | HMAC-SHA256 of the body |
| `X-Webhook-Event` | `incident.created` | The event type |
| `X-Webhook-ID` | `evt_01HZ3KF9...` | Unique event ID for deduplication |

---

## Retry Policy

| Attempt | Delay | Condition |
|---|---|---|
| 1 | Immediate | First delivery |
| 2 | 5 seconds | HTTP error or timeout |
| 3 | 25 seconds | HTTP error or timeout |
| — | Abandoned | After 3 failed attempts |

> Receiver endpoints must respond with `2xx` within **10 seconds**. Anything else triggers a retry.

---

## Idempotency

Each webhook delivery includes a **unique `id`** (`X-Webhook-ID` header and `id` field in the body). External receivers should store processed IDs to avoid processing the same event twice upon retries:

```typescript
const processedIds = new Set<string>();

function handleWebhook(payload: WebhookPayload) {
  if (processedIds.has(payload.id)) return; // Already processed
  processedIds.add(payload.id);
  // ... process event
}
```

---

## Catalog of Available Events

| Event | Triggered when |
|---|---|
| `incident.created` | A new incident is submitted |
| `incident.updated` | An incident's fields are changed |
| `incident.resolved` | Status changes to `RESUELTO` |
| `user.registered` | A new user account is created |
| `user.updated` | A user's profile is modified |
| `property.created` | A new property is added |

> **Add new events here** whenever a new resource action is implemented that external integrations might care about.

---

## Test Endpoint (Ping)

```http
POST /v1/webhooks/:id/test HTTP/1.1
Authorization: Bearer <token>
```

Sends a synthetic test event to the subscription URL:

```json
{
  "id": "evt_test_ping",
  "event": "webhook.test",
  "createdAt": "...",
  "data": { "message": "This is a test ping from Foundation" }
}
```

The response returns the HTTP status code received from the external endpoint.

---

## Security Checklist

- [x] All deliveries are signed with HMAC-SHA256
- [x] Secrets are stored hashed (never in plain text)
- [x] 10-second delivery timeout prevents hanging
- [x] Retries use exponential backoff
- [x] Each event has a unique ID for idempotency
- [ ] (Future) Delivery logs per subscription (view last N deliveries + status)
- [ ] (Future) Automatic deactivation after N consecutive failures

---

## Integration Examples

### N8N

1. Create a **Webhook** node in N8N → copy the URL.
2. `POST /v1/webhooks` with that URL and your desired events.
3. Configure your N8N workflow to process `event` + `data` fields.

### Zapier

1. Create a **Webhooks by Zapier** trigger → copy the webhook URL.
2. `POST /v1/webhooks` from the API or settings UI.
3. Zapier auto-detects the payload shape on first event.

### Custom Script

```bash
# Register endpoint
curl -X POST https://api.example.com/v1/webhooks \
  -H "Authorization: Bearer <your_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourserver.com/hooks/foundation",
    "events": ["incident.created"],
    "secret": "super-secret-key"
  }'
```
