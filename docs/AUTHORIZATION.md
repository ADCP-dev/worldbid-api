# Authorization — Guards, Decorators & RBAC

This project uses **Role-Based Access Control (RBAC)** on both the backend (NestJS guards + decorators) and the frontend (Nuxt middleware + Pinia store).

---

## Backend Authorization

### Auth Decorators

Located in `src/modules/iam/auth/decorators/auth.decorator.ts`.

These are the **primary way to protect endpoints**. Use them directly on controllers or handler methods:

| Decorator | Guard used | Description |
|---|---|---|
| `@JwtAuth()` | `JwtAuthGuard` | Requires a valid JWT (`Authorization: Bearer <token>`) |
| `@ApiKeyAuth()` | `ApiKeyAuthGuard` | Requires `X-API-Key: <key>` header |
| `@FlexibleAuth()` | `FlexibleAuthGuard` | Accepts JWT **or** API Key |
| `@OptionalAuth()` | `OptionalAuthGuard` | User may be anonymous — no rejection |
| `@AdminAuth()` | `JwtAuthGuard` + `RolesGuard` | JWT + `admin` role required |
| `@CustomerAuth()` | `JwtAuthGuard` + `RolesGuard` | JWT + `customer` role required |

### Usage Examples

```typescript
import { JwtAuth, AdminAuth, CustomerAuth, FlexibleAuth } from '@iam/auth/decorators/auth.decorator';

// Require a valid JWT (any authenticated user)
@JwtAuth()
@Get('profile')
getProfile(@Request() req) {
  return req.user;
}

// Require admin role
@AdminAuth()
@Get('admin/users')
findAllUsers() { ... }

// Require customer role
@CustomerAuth()
@Get('my-orders')
getMyOrders() { ... }

// Accepts both JWT and API Keys
@FlexibleAuth()
@Get('data')
getData() { ... }

// No auth required — user may still be in request if provided
@OptionalAuth()
@Get('public-feed')
getPublicFeed() { ... }
```

### Role-Only Decorator (`@Roles`)

Located in `src/modules/iam/roles/roles.decorator.ts`.

```typescript
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';

// Combined with JwtAuth explicitly
@JwtAuth()
@Roles(RoleEnum.admin)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

> Prefer the pre-built `@AdminAuth()` and `@CustomerAuth()` shortcuts over combining `@JwtAuth()` + `@Roles()` manually.

---

### Available Roles

```typescript
// src/modules/iam/roles/roles.enum.ts
export enum RoleEnum {
  admin =    1,
  customer = 2,
}
```

---

### How The Guards Work

#### `JwtAuthGuard`

- Extends Passport's `jwt` strategy.
- The `JwtStrategy` (`src/modules/iam/auth/strategies/jwt.strategy.ts`) validates the JWT and attaches `req.user` with the full user object including `role`.

#### `RolesGuard`

Located at `src/modules/iam/roles/roles.guard.ts`.

- Reads the `roles` metadata set by `@Roles()`.
- Checks `req.user.role.id` against the allowed role ids.
- If no `@Roles()` is set, the guard passes (it's not standalone — it only restricts when roles are explicitly required).

```typescript
// Simplified logic:
const roles = reflector.get('roles', handler);
if (!roles?.length) return true; // no restriction
const userRoleId = String(request.user?.role?.id);
return roles.map(String).includes(userRoleId);
```

#### `ApiKeyAuthGuard`

- Reads the `X-API-Key` header.
- Validates the key via `ApiKeyStrategy` → queries the `api_keys` table, hashes comparison.

#### `FlexibleAuthGuard` / `OptionalAuthGuard`

- Located in `src/modules/iam/auth/guards/jwt-or-api-key.guard.ts`.
- Tries JWT first, then API Key. `OptionalAuth` does not reject anonymous requests.

---

### Getting the Authenticated User in a Controller

Use the `@CurrentUser()` decorator:

```typescript
import { CurrentUser } from '@iam/auth/decorators/current-user.decorator';
import { User } from '@users/domain/user';

@JwtAuth()
@Get('me')
getMe(@CurrentUser() user: User) {
  return user;
}
```

Or get only the user ID:

```typescript
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@JwtAuth()
@Delete('me')
deleteAccount(@UserId() userId: string) { ... }
```

---

### Protecting Based on Ownership (Same User Rule)

For resources that belong to the current user, check ownership in the service:

```typescript
@JwtAuth()
@Get(':id')
async findOne(@Param('id') id: string, @CurrentUser() user: User) {
  const resource = await this.service.findById(id);
  if (resource.userId !== user.id) {
    throw new ForbiddenException();
  }
  return resource;
}
```

---

## Frontend Authorization

### Auth Store (`useAuthStore`)

Located in `apps/front/modules/auth/stores/auth.store.ts`. Persisted with `pinia-plugin-persistedstate`.

**State:**
- `token` — access JWT
- `refreshToken` — used to silently renew the access token
- `tokenExpires` — Unix timestamp in ms
- `user` — full user object (`{ id, firstName, lastName, email, role: { id, name } }`)

**Key Getters:**

| Getter | Description |
|---|---|
| `isAuthenticated` | `!!token` |
| `isTokenExpired` | `Date.now() >= tokenExpires` |
| `isAdmin` | `user.role.name === 'admin'` |
| `isCustomer` | `user.role.name === 'customer'` |
| `fullName` | `firstName + ' ' + lastName` |

**Automatic Token Refresh:**

After login, `startRefreshTokenTimer()` schedules a `setTimeout` to refresh the access token **1 minute before expiry**. This runs silently in the background.

---

### Route Middleware

Three middleware files in `apps/front/modules/auth/middleware/`:

#### `admin.global.ts` — Applied to every route automatically

Protects all `/app/*` routes:
1. Checks `isAuthenticated` — redirects to `/login` if not.
2. Checks `isAdmin` — throws a `403` error if not admin.
3. Checks `isTokenExpired` — attempts refresh, redirects to login on failure.

```typescript
// In a page — no additional middleware needed for /app/* admin routes
// they are protected automatically
```

#### `auth.ts` — Named middleware (opt-in per page)

Requires the user to be logged in. Redirects to `/login` if not.

```vue
<script setup>
definePageMeta({ middleware: 'auth' })
</script>
```

#### `guest.ts` — Named middleware (opt-in per page)

Redirects authenticated users away from public pages (login, register).

```vue
<script setup>
definePageMeta({ middleware: 'guest' })
</script>
```

---

### Conditional UI Based on Role

```vue
<script setup>
const authStore = useAuthStore();
</script>

<template>
  <!-- Only visible to admins -->
  <Button v-if="authStore.isAdmin">Manage Users</Button>

  <!-- Only visible to customers -->
  <div v-if="authStore.isCustomer">Your Orders</div>
</template>
```

---

### API Request Authentication

All API requests go through `fetchWrapper` (`apps/front/helpers/fetch-wrapper.ts`), which automatically attaches the `Authorization: Bearer <token>` header from the auth store.

```typescript
import { fetchWrapper } from '@/helpers/fetch-wrapper';

// Automatically authenticated
const users = await fetchWrapper.get(`${apiUrl}/users`);
const created = await fetchWrapper.post(`${apiUrl}/products`, { name: 'Test' });
```
