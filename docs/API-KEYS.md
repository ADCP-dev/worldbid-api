# API Keys — Permanent Integration Tokens

API Keys are **long-lived, permanent credentials** designed for machine-to-machine integrations and external services. Unlike JWT tokens that expire, API keys remain valid until explicitly revoked by the user.

> **Use case:** Connecting third-party services (e.g. Zapier, N8N, custom scripts) to the platform without requiring interactive login.

---

## Key Format

API keys are generated with a secure random prefix:

```
ak_<random32chars><timestamp_base36>
```

Example: `ak_f3kx9mZ2pQrLv8tNcDwA1bYuoE4h7isJ1k4c2vw`

---

## Backend — Module Location

```
src/modules/iam/api-keys/
├── domain/
│   └── api-key.ts               # Domain entity: { id, key, userId, user, createdAt, updatedAt }
├── dto/
│   └── api-key-response.dto.ts  # Response DTO (never exposes raw key hash)
├── infrastructure/
│   ├── entities/api-key.entity.ts
│   ├── mappers/api-key.mapper.ts
│   └── api-key.repository.ts
├── api-keys.controller.ts
├── api-keys.service.ts
└── api-keys.module.ts
```

---

## REST Endpoints

All endpoints require **JWT authentication** (`Authorization: Bearer <token>`). Users can only manage **their own** API key — there is one key per user.

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/api-keys` | Get current API key (auto-creates one if none exists) |
| `POST` | `/v1/api-keys/regenerate` | Revoke current key and generate a new one |
| `DELETE` | `/v1/api-keys` | Revoke the current API key |

### Response shape

```json
{
  "id": 42,
  "key": "ak_f3kx9mZ2pQrLv8tNcDwA1bYuoE4h7isJ1k4c2vw",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

> ⚠️ The plain-text key is **only returned at creation/regeneration time**. Store it securely — it cannot be retrieved again.

---

## Using an API Key in Requests

Pass the key in the `X-API-Key` header:

```http
GET /v1/incidents HTTP/1.1
Host: api.example.com
X-API-Key: ak_f3kx9mZ2pQrLv8tNcDwA1bYuoE4h7isJ1k4c2vw
```

Using `curl`:

```bash
curl -H "X-API-Key: ak_f3kx9mZ2pQrLv8tNcDwA1bYuoE4h7isJ1k4c2vw" \
  https://api.example.com/v1/incidents
```

Using JavaScript `fetch`:

```typescript
const response = await fetch('https://api.example.com/v1/incidents', {
  headers: {
    'X-API-Key': 'ak_f3kx9mZ2pQrLv8tNcDwA1bYuoE4h7isJ1k4c2vw',
  },
});
```

---

## Protecting Endpoints to Accept API Keys

Use the auth decorators from `@iam/auth/decorators/auth.decorator`:

```typescript
import { ApiKeyAuth, FlexibleAuth } from '@iam/auth/decorators/auth.decorator';

// Only API Key allowed
@ApiKeyAuth()
@Get('webhook-source')
receivePush() { ... }

// JWT or API Key (most common for integration endpoints)
@FlexibleAuth()
@Get('data')
getData() { ... }
```

| Decorator | Accepts |
|---|---|
| `@ApiKeyAuth()` | API Key only (`X-API-Key` header) |
| `@FlexibleAuth()` | JWT **or** API Key |
| `@JwtAuth()` | JWT only (interactive sessions) |

---

## How the Guard Works

```
Request → ApiKeyAuthGuard
  → reads X-API-Key header
  → ApiKeyStrategy.validate()
    → ApiKeysService.validateApiKey(key)
      → queries api_keys table, compares hash
      → returns { id, email, role } user object → req.user
```

The `ApiKeyStrategy` (at `src/modules/iam/auth/strategies/api-key.strategy.ts`) attaches the same `req.user` shape as the JWT strategy, so **all downstream code (guards, decorators, services) works identically** regardless of whether the user authenticated via JWT or API key.

---

## API Key Lifecycle

```
User requests key (GET /v1/api-keys)
    ↓
Key is auto-created if none exists
    ↓
User copies key and stores it securely in their integration
    ↓
Integration makes requests using X-API-Key header
    ↓
User rotates key when needed (POST /v1/api-keys/regenerate)
    → old key is immediately invalidated
    ↓
User revokes key when no longer needed (DELETE /v1/api-keys)
```

---

## Service API

```typescript
// src/modules/iam/api-keys/api-keys.service.ts

validateApiKey(key: string): Promise<User | null>
  // Used by the strategy to resolve the API key to a user

findByUserId(userId: number): Promise<ApiKey | null>
  // Get current key for a user

regenerateApiKey(userId: number): Promise<ApiKey>
  // Atomically removes old key and creates a new one

revokeApiKey(userId: number): Promise<void>
  // Removes the key (sets null in database)
```

---

## Security Considerations

| Concern | How it's handled |
|---|---|
| Key secrecy | Keys are stored hashed in the database; plain text only returned at creation |
| Key rotation | `POST /regenerate` atomically invalidates old key |
| Scope | One key per user; key inherits the user's role and permissions |
| Revocation | Immediate — `DELETE /v1/api-keys` takes effect on the next request |
| No expiration | By design for integrations; complement with key rotation policy |

> **Recommendation:** Treat API keys like passwords. Never commit them to source control. Use environment variables or a secrets manager in integrations.

---

## Frontend — Accessing the API Key UI

The API key can be exposed in a settings page. Example composable usage:

```typescript
// In a settings page component
const apiUrl = useRuntimeConfig().public.apiUrl;
const { data: apiKey, refresh } = await useFetch(`${apiUrl}/api-keys`, {
  headers: { Authorization: `Bearer ${authStore.token}` },
});

async function regenerate() {
  await $fetch(`${apiUrl}/api-keys/regenerate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authStore.token}` },
  });
  await refresh();
}
```
