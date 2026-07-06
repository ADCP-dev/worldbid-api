# Frontend Layers â€” Nuxt Module System, Auth & Routing

The frontend (`apps/front`) is built as a **Nuxt 3 app with layers** (called "modules" in this codebase). Each layer is a self-contained Nuxt mini-app included via the `extends` array.

---

## Layer Structure

```
apps/front/
â”œâ”€â”€ nuxt.config.ts       # Main app â€” extends all layers
â”œâ”€â”€ app.vue
â”œâ”€â”€ layouts/
â”‚   â”œâ”€â”€ default.vue      # Authenticated layout (sidebar + header)
â”‚   â””â”€â”€ blank.vue        # Unauthenticated layout (login, register)
â””â”€â”€ modules/
    â”œâ”€â”€ ui-app/          # Shared UI components, DataTable, Form
    â”œâ”€â”€ auth/            # Login, register, password flow + auth store
    â””â”€â”€ <feature>/       # Feature-specific pages and logic
```

---

## Creating a New Layer

### 1. Create the folder

```
apps/front/modules/my-feature/
â”œâ”€â”€ nuxt.config.ts
â”œâ”€â”€ pages/
â”‚   â””â”€â”€ (app)/
â”‚       â””â”€â”€ my-feature/
â”‚           â””â”€â”€ index.vue
â”œâ”€â”€ components/
â”œâ”€â”€ composables/
â””â”€â”€ plugins/
    â””â”€â”€ nav.ts           # Optional: inject sidebar menu items
```

### 2. Create `nuxt.config.ts` inside the layer

```typescript
// apps/front/modules/my-feature/nuxt.config.ts
export default defineNuxtConfig({
  components: [{ path: './components', pathPrefix: false }],
  imports: { dirs: ['./stores', './composables'] },
});
```

### 3. Register the layer in the main app

```typescript
// apps/front/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    './modules/ui-app',
    './modules/auth',
    './modules/my-feature',  // â† add here
  ],
});
```

---

## Page Routing & Layouts

Pages inside `(app)/` use the **`default` layout** (has the sidebar and header). Pages at the root level use the **`blank` layout** by default.

```
pages/
â”œâ”€â”€ (app)/
â”‚   â””â”€â”€ my-feature/
â”‚       â””â”€â”€ index.vue   â†’ route: /app/my-feature   (default layout)
â”œâ”€â”€ login.vue           â†’ route: /login             (blank layout)
â””â”€â”€ register.vue        â†’ route: /register          (blank layout)
```

To use the blank layout explicitly:

```vue
<script setup>
definePageMeta({ layout: 'blank' });
</script>
```

---

## Route Middleware

Located in `apps/front/modules/auth/middleware/`.

### `admin.global.ts` â€” Automatic, applies to every route

Protects all `/app/*` routes:
- Not logged in â†’ redirect to `/login`
- Not admin â†’ throws 403 error
- Token expired â†’ auto-refresh, or redirect to login

> This middleware runs **automatically on every navigation**. No annotation needed on pages.

### `auth.ts` â€” Named, opt-in per page

Use for pages accessible by *any authenticated user* (not just admins):

```vue
<script setup>
definePageMeta({ middleware: 'auth' });
</script>
```

### `guest.ts` â€” Named, opt-in per page

Use on public pages (login, register) to redirect already-authenticated users:

```vue
<script setup>
definePageMeta({ middleware: 'guest' });
</script>
```

---

## Auth Store (`useAuthStore`)

`apps/front/modules/auth/stores/auth.store.ts` â€” **persisted** with pinia-plugin-persistedstate (survives browser refresh).

### State

```typescript
{
  token: string | null;          // Access JWT
  refreshToken: string | null;   // Refresh JWT
  tokenExpires: number | null;   // Unix ms
  user: User | null;             // Full user object with role
}
```

### Key Getters

```typescript
const auth = useAuthStore();

auth.isAuthenticated  // true if token exists
auth.isAdmin          // user.role.name === 'admin'
auth.isCustomer       // user.role.name === 'customer'
auth.isTokenExpired   // Date.now() >= tokenExpires
auth.fullName         // "John Doe"
```

### Key Actions

```typescript
auth.login(email, password)       // â†’ sets tokens + user, starts refresh timer
auth.logout()                     // â†’ clears state, navigates to /login
auth.refreshAccessToken()         // â†’ called automatically 1 min before expiry
auth.getMe()                      // â†’ fetches/updates user from API
auth.updateProfile(data)          // â†’ PATCH /auth/me
auth.forgotPassword(email)
auth.resetPassword(hash, password)
auth.confirmEmail(hash)
```

---

## API Calls (`fetchWrapper`)

All API calls should go through `fetchWrapper` (found in `apps/front/helpers/fetch-wrapper.ts`). It:
- Automatically attaches `Authorization: Bearer <token>` from the auth store.
- Handles JSON serialization/deserialization.
- Re-throws errors for the caller to handle.

```typescript
import { fetchWrapper } from '@/helpers/fetch-wrapper';

const runtimeConfig = useRuntimeConfig();
const baseUrl = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;

// Examples
const items = await fetchWrapper.get(`${baseUrl}/products`);
const created = await fetchWrapper.post(`${baseUrl}/products`, { name: 'Test' });
const updated = await fetchWrapper.patch(`${baseUrl}/products/1`, { name: 'Updated' });
await fetchWrapper.delete(`${baseUrl}/products/1`);
```

---

## TanStack Query (Server State)

For data fetching with caching and refetching, use [`@tanstack/vue-query`](https://tanstack.com/query/latest/docs/vue/overview):

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';

const { data: products, isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: () => fetchWrapper.get(`${baseUrl}/products`),
});

const queryClient = useQueryClient();
const { mutate: createProduct } = useMutation({
  mutationFn: (data) => fetchWrapper.post(`${baseUrl}/products`, data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
});
```

---

## Injecting Sidebar Links

To add your feature's pages to the sidebar, create a plugin in your layer:

```typescript
// apps/front/modules/my-feature/plugins/nav.ts
export default defineNuxtPlugin(() => {
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  menuItems.value.push({
    heading: 'My Feature',
    items: [
      { title: 'Dashboard', icon: 'LayoutDashboard', link: '/app/my-feature' },
    ],
  });
});
```

Available icons come from `lucide-vue-next`. See the [Lucide icon list](https://lucide.dev/icons/).

---

## UI Components (DaisyUI + Custom)

Located in `apps/front/modules/ui-app/components/`.

### `DataTable.vue`

Server-side `TanStack Table` wrapper with sorting, filtering, and pagination.

```vue
<DataTable
  :columns="columns"
  :fetch-fn="fetchProducts"
  default-sort-field="createdAt"
/>
```

Where `fetchFn` is a function that receives `{ page, pageSize, sort, filters }` and returns `{ data: [], total: number }`.

### Form Components

All live in `apps/front/modules/ui-app/components/form/`:

```vue
<FormInput name="email" label="Email" placeholder="Enter email" />
<FormSelect name="role" label="Role" :options="roleOptions" />
<FormDate name="birthDate" label="Date of Birth" />
<FormTextArea name="bio" label="Bio" />
<FormFile name="avatar" label="Avatar" accept="image/*" />
<FormMultipleFile name="attachments" label="Attachments" />
```

All components:
- Work inside a `vee-validate` `<Form>` (use `useForm()` with a Zod schema).
- Display validation errors automatically.
- Support `disabled` and `required` props.


## API calls — useApi() + TanStack Query

All HTTP calls in the front go through the centralized `useApi()` composable, which lives at `apps/front/composables/useApi.ts`. It handles base URL, auth token injection, and 401-refresh-once-then-retry. On top of `useApi()`, every entity has a composable in `apps/front/composables/use<Entity>.ts` that wraps TanStack Query for cache, invalidation, and loading/error states.

### useApi() — the transport layer

```ts
const api = useApi()
await api.get<User[]>('/users', { query: { page: 1, limit: 20 } })
await api.post<User>('/users', { email, firstName, lastName })
await api.patch<User>('/users/' + id, { firstName })
await api.delete('/users/' + id)
```

Responsibilities owned by `useApi()`:

- `Authorization: Bearer <token>` header (skipped for `/auth/*` endpoints)
- 401 → one token refresh → one retry → logout if refresh fails
- Query string serialization via the `query` option
- Typed errors (`ApiError extends Error { status, data }`)

### One composable per entity

`composables/useUsers.ts` exports one TanStack Query hook per operation:

```ts
useUsersQuery(params)              // GET /users, queryKey: ['users', params]
useUserQuery(id)                  // GET /users/:id, queryKey: ['user', id]
useCreateUserMutation()           // POST /users, invalidates ['users']
useUpdateUserMutation()           // PATCH /users/:id, invalidates ['users'] + ['user', id]
useDeleteUserMutation()           // DELETE /users/:id, invalidates ['users']
useChangePasswordMutation()       // PATCH /users/:id, invalidates ['user', id]
useChangeUserRoleMutation()       // PATCH /users/:id, invalidates ['users'] + ['user', id]
useChangeUserStatusMutation()     // PATCH /users/:id, invalidates ['users'] + ['user', id]
```

Use these in components:

```vue
<script setup>
const { data: users, isLoading } = useUsersQuery({ page: 1 })
const createUser = useCreateUserMutation()
async function onSubmit(form: CreateUserInput) {
  await createUser.mutateAsync(form)
}
</script>
```

### Naming convention

| Operation | Hook name |
| --- | --- |
| GET list | `use<Entity>Query` |
| GET single | `use<Entity>Query` with id arg |
| POST create | `useCreate<Entity>Mutation` |
| PATCH update | `useUpdate<Entity>Mutation` |
| DELETE remove | `useDelete<Entity>Mutation` |
| Custom action | `use<Action><Entity>Mutation` |

### Query keys

Convention: `['<entity>', '<verb>', ...args]`. Examples:

- `['users', { page: 1 }]` — list with params
- `['user', 42]` — single user by id
- `['subscription', userId]` — single subscription

Mutations that affect an entity must invalidate the relevant keys in their `onSuccess` callback.

### Legacy / forbidden patterns

- `fetchWrapper.X(url)` — DEPRECATED, will be removed. Use `useApi().X()` instead.
- `services/<x>.service.ts` — DEPRECATED. Convert each method to a TanStack Query composable in `composables/use<X>.ts`.
- Direct `fetch(url, { method, headers })` — DEPRECATED. Use `useApi().X()` so the auth header and 401-refresh are applied.

These three are tolerated for now while the rest of the app is migrated, but new code MUST go through `useApi()` and TanStack Query.
