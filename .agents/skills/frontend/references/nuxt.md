# Nuxt 4+ — Reference

## Quick Start

```ts
// server/api/hello.get.ts
export default defineEventHandler(async (event) => {
  const { name } = await getValidatedQuery(event, z.object({
    name: z.string().default('world'),
  }).parse)
  return { message: `Hello ${name}` }
})
```

## Nuxt 4 Key Changes

| Old | New |
|-----|-----|
| `<Nuxt />` | `<NuxtPage />` |
| `context.params` | `getRouterParam(event, 'name')` |
| `window.origin` | `useRequestURL().origin` |
| String routes | Typed router (route names) |
| Separate layouts/ | Parent routes with `<slot>` |

## Server Routes (`server/`)

```ts
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return { id, name: 'Test' }
})

// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name } = await getValidatedBody(event, z.object({
    name: z.string().min(2),
  }).parse)
  return { success: true }
})

// server/middleware/auth.ts — runs before all API routes
export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'authorization')
  if (!token) throw createError({ statusCode: 401 })
})

// WebSocket (Nuxt 4.3+)
export default defineWebSocketHandler({
  open(peer) { peer.send('connected') },
  message(peer, message) { peer.send(`echo: ${message.text()}`) },
})

// SSE (Nuxt 4.3+)
export default defineEventHandler(async (event) => {
  const eventStream = createEventStream(event)
  eventStream.push({ event: 'update', data: 'hello' })
  return eventStream
})
```

## Routing (`pages/`)

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
definePageMeta({ title: 'Home', layout: 'default' })
</script>

<!-- pages/users/[id].vue — dynamic route -->
<script setup lang="ts">
const route = useRoute('users-id')
const { data: user } = await useFetch(`/api/users/${route.params.id}`)
</script>

<!-- Route groups: (auth)/login.vue → no layout inheritance -->
```

## Composables

```ts
const { data, error, status } = await useFetch('/api/users')
const { data, refresh } = await useAsyncData('key', () => $fetch('/api/users'))
const url = useRequestURL()         // { origin, pathname, searchParams }
const head = useHead({ title: 'Page' })
const cookie = useCookie('token')
const config = useRuntimeConfig()
const { t, locale } = useI18n()
```

## Components

```vue
<NuxtPage />               <!-- Page outlet -->
<NuxtLink to="/users">     <!-- Client-side navigation -->
<NuxtImg src="/img.png" /> <!-- Optimized image -->
<NuxtTime :datetime="d" /> <!-- Formatted date -->
```

## Config (`nuxt.config.ts`)

```ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n', '@pinia/nuxt'],
  imports: { dirs: ['composables/**'] },  // auto-import
  routeRules: { '/old': { redirect: '/new' } },
  nitro: { experimental: { websocket: true } },
})
```
