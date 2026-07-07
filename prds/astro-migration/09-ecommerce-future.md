---
doc: astro-migration/09-ecommerce-future
title: "Preparación para Ecommerce"
status: draft
created: 2026-07-07
---

# Preparación para Ecommerce

## Principio

Ecommerce divide en **parte pública** (Astro, catálogo, carrito) y **parte admin** (Nuxt, gestión productos, pedidos, stock). Backend en NestJS siguiendo convención extension `ext_ecommerce_*`.

```
┌─────────────────────────────────────────────────────┐
│                   NestJS API                         │
│  extensions/ecommerce/  (tablas ext_ecommerce_*)    │
│  Products, Categories, Orders, Stock, Prices        │
└──────────────┬──────────────────────────────────────┘
               │
   ┌───────────┴────────────┐
   │                        │
┌──▼──────────────┐  ┌──────▼──────────────┐
│  Astro web      │  │  Nuxt admin         │
│  /tienda/**     │  │  /app/ecommerce/**  │
│  Público        │  │  Gestión            │
│  Catálogo       │  │  Productos          │
│  Carrito island │  │  Pedidos            │
│  Checkout       │  │  Stock              │
└─────────────────┘  └─────────────────────┘
```

## Parte pública (Astro)

### Páginas

| Ruta | Render | Origen |
|------|--------|--------|
| `/tienda` | Estático + islands | Fetch API NestJS en build |
| `/tienda/c/[categoria]` | Estático + islands | Fetch API |
| `/tienda/producto/[slug]` | Estático | Fetch API build time |
| `/tienda/carrito` | Island (Vue) | Estado local (`localStorage`) |
| `/tienda/checkout` | Island (Vue) o redirect gateway | API |

### Islands Vue

| Island | Función |
|--------|---------|
| `Carrito.vue` | Estado carrito en `localStorage`, add/remove, total |
| `CheckoutForm.vue` | Form datos cliente + redirect a gateway (Stripe/PayPal) |
| `FiltrosCatalogo.vue` (opcional) | Filtros client-side sobre catálogo pre-cargado |

### SEO ecommerce

| Schema.org | Dónde |
|------------|-------|
| `Product` | `/tienda/producto/[slug]` (FR-015) |
| `Offer` | dentro de Product |
| `Review` / `AggregateRating` | si reviews activos |
| `BreadcrumbList` | breadcrumbs categoría → producto |
| `ItemList` | `/tienda` y `/tienda/c/[categoria]` |

## Parte admin (Nuxt)

| Ruta | Función |
|------|---------|
| `/app/ecommerce` | Dashboard ecommerce |
| `/app/ecommerce/products` | CRUD productos |
| `/app/ecommerce/categories` | CRUD categorías |
| `/app/ecommerce/orders` | Gestión pedidos |
| `/app/ecommerce/stock` | Inventario |
| `/app/ecommerce/customers` | Clientes (link a CRM si aplica) |

> Sigue convención extension: `apps/front/extensions/ecommerce/pages/app/ecommerce/**`. Tablas con prefijo `ext_ecommerce_*` (regla AGENTS.md).

## Backend (NestJS)

### Extension `extensions/ecommerce/`

| Tabla | Convención |
|-------|------------|
| `ext_ecommerce_products` | Productos |
| `ext_ecommerce_categories` | Categorías |
| `ext_ecommerce_orders` | Pedidos |
| `ext_ecommerce_order_items` | Items por pedido |
| `ext_ecommerce_stock` | Stock por producto/variante |
| `ext_ecommerce_prices` | Precios (si multi-moneda) |
| `ext_ecommerce_reviews` | Reviews (opcional) |

> Sigue regla prefijo `ext_<name>_` (ver AGENTS.md sección convención tablas). Generar con `pnpm generate:extension -- --name=Ecommerce`.

### Endpoints API (referencia)

| Endpoint | Uso | Auth |
|----------|-----|------|
| `GET /api/v1/ecommerce/products` | Listar productos | Público |
| `GET /api/v1/ecommerce/products/[slug]` | Detalle producto | Público |
| `GET /api/v1/ecommerce/categories` | Categorías | Público |
| `POST /api/v1/ecommerce/orders` | Crear pedido (checkout) | Público |
| `GET /api/v1/ecommerce/admin/orders` | Listar pedidos | Admin (RBAC) |
| `POST /api/v1/ecommerce/admin/products` | Crear producto | Admin (RBAC) |

> Endpoints exactos: por definir al implementar Fase 3. `[NEEDS CLARIFICATION]`

## Integración Stripe (si aplica)

Foundation ya tiene `extensions/stripe`. Ecommerce puede:

| Opción | Descripción |
|--------|-------------|
| Reutilizar `extensions/stripe` | Checkout via Stripe existente (DRY) |
| Integración directa en `extensions/ecommerce` | Endpoints propios (más acoplado) |

> Q-012 resuelto: reutilizar `extensions/stripe` (DRY). Ecommerce delega checkout a Stripe existente.

## Consideraciones técnicas

### Filtros y búsqueda

| Approach | Pros | Contras |
|----------|------|---------|
| Client-side sobre catálogo pre-cargado | Simple, sin backend | Limitado a N productos |
| Server-side con API query params | Escalable | Requiere backend o edge function |
| Algolia / Meilisearch | Search-as-you-type | Costo + integración |

> Q-013 resuelto: client-side filters sobre catálogo pre-cargado. Migrar a server-side cuando catálogo crezca.

### Paginación

| Approach | Cuándo |
|----------|--------|
| Estática (todas páginas pre-generadas) | Catálogo chico (< 100 productos) |
| Server-side (API paginada, fetch en cliente) | Catálogo grande |

### Stock

- Stock en DB (NestJS).
- Check stock en checkout (API call).
- Si agotado, mostrar badge en Astro (build-time data, puede stale → island para check real-time si crítico).

### Carrito

- Estado en `localStorage` (island Vue).
- No requiere auth (carrito guest).
- Sync con cuenta usuario si logueado (opcional, futuro).

## SEO considerations

- Catálogo pre-renderizado estático → indexable por crawlers.
- Slugs producto SEO-friendly.
- Imágenes producto con `alt` + `astro:assets` (optimización).
- Sitemap incluye todas las páginas producto (FR-012).
- JSON-LD Product con price, availability, rating (FR-015).

## Riesgos (ver `05-risks-and-tradeoffs.md`)

- R9: Carrito island complejo (estado SPA dentro de Astro) → mantener carrito simple, checkout delega a gateway.
- Stock stale en estático → island check stock real-time en producto/checkout.
- Catálogo grande → build slow → paginación server-side, no pre-generar todo.