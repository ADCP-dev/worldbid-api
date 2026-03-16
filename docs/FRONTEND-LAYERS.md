# Frontend Layers — Nuxt Module System, Auth & Routing

The frontend (`apps/front`) is built as a **Nuxt 3 app with layers** (called "modules" in this codebase). Each layer is a self-contained Nuxt mini-app included via the `extends` array.

---

## Layer Structure

```
apps/front/
├── nuxt.config.ts       # Main app — extends all layers
├── app.vue
├── layouts/
│   ├── default.vue      # Authenticated layout (sidebar + header)
│   └── blank.vue        # Unauthenticated layout (login, register)
└── modules/
    ├── ui-app/          # Shared UI components, DataTable, Form
    ├── auth/            # Login, register, password flow + auth store
    └── <feature>/       # Feature-specific pages and logic
```

---

## Creating a New Layer

### 1. Create the folder

```
apps/front/modules/my-feature/
├── nuxt.config.ts
├── pages/
│   └── (app)/
│       └── my-feature/
│           └── index.vue
├── components/
├── composables/
└── plugins/
    └── nav.ts           # Optional: inject sidebar menu items
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
    './modules/my-feature',  // ← add here
  ],
});
```

---

## Page Routing & Layouts

Pages inside `(app)/` use the **`default` layout** (has the sidebar and header). Pages at the root level use the **`blank` layout** by default.

```
pages/
├── (app)/
│   └── my-feature/
│       └── index.vue   → route: /app/my-feature   (default layout)
├── login.vue           → route: /login             (blank layout)
└── register.vue        → route: /register          (blank layout)
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

### `admin.global.ts` — Automatic, applies to every route

Protects all `/app/*` routes:
- Not logged in → redirect to `/login`
- Not admin → throws 403 error
- Token expired → auto-refresh, or redirect to login

> This middleware runs **automatically on every navigation**. No annotation needed on pages.

### `auth.ts` — Named, opt-in per page

Use for pages accessible by *any authenticated user* (not just admins):

```vue
<script setup>
definePageMeta({ middleware: 'auth' });
</script>
```

### `guest.ts` — Named, opt-in per page

Use on public pages (login, register) to redirect already-authenticated users:

```vue
<script setup>
definePageMeta({ middleware: 'guest' });
</script>
```

---

## Auth Store (`useAuthStore`)

`apps/front/modules/auth/stores/auth.store.ts` — **persisted** with pinia-plugin-persistedstate (survives browser refresh).

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
auth.login(email, password)       // → sets tokens + user, starts refresh timer
auth.logout()                     // → clears state, navigates to /login
auth.refreshAccessToken()         // → called automatically 1 min before expiry
auth.getMe()                      // → fetches/updates user from API
auth.updateProfile(data)          // → PATCH /auth/me
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
