# Módulo CMS - Documentación

## Visión General

El módulo CMS permite gestionar contenido del sitio web incluyendo:

- **Páginas CMS**: Páginas landing y contenido editable (SEO, traducciones)
- **Blog**: Entradas de blog conTipTap editor y sistema de categorías
- **SEO**: Metadatos SEO por página e idioma (JSON-LD)

---

## Arquitectura

### Backend (NestJS)

```
/api/v1/cms/pages          # CRUD páginas
/api/v1/cms/pages/public   # Páginas públicas (solo publicadas)
/api/v1/cms/blog/posts     # CRUD blog posts
/api/v1/cms/blog/posts/public  # Blog posts públicos
/api/v1/cms/blog/categories    # Categorías del blog
/api/v1/cms/seo            # Metadatos SEO
/api/v1/cms/media/upload   # Subir imágenes para TipTap
/api/sitemap/blog          # Endpoints para sitemap
/api/sitemap/cms-pages
```

### Frontend (Nuxt)

```
/app/cms                   # Dashboard CMS
/app/cms/pages             # Gestionar páginas
/app/cms/pages/create      # Crear página
/app/cms/pages/:id/edit    # Editar página
/app/cms/blog/posts        # Gestionar posts
/app/cms/blog/categories   # Gestionar categorías
/[lang]/page/:slug         # Página CMS pública (SSR)
/[lang]/blog               # Blog listing (SSG)
/[lang]/blog/:slug         # Blog post (SSG)
```

---

## Uso del CMS

### 1. Crear una Página

1. Ir a `/app/cms/pages`
2. Click en "Crear Página"
3. Rellenar:
   - **Slug**: Identificador único (ej: `home`, `about-us`)
   - **Route**: Ruta fija (ej: `/es/home`)
   - **Template**: `landing`, `generic`, o `contact`
   - **Order**: Orden de visualización
4. Click en "Guardar"

### 2. Editar Contenido y SEO

1. Ir a `/app/cms/pages`
2. Click en "Edit" en la página deseada
3. **Traducciones**: Seleccionar idioma y editar título/contenido
4. **SEO**: Rellenar metaTitle, metaDescription, keywords, ogImage

### 3. Crear un Blog Post

1. Ir a `/app/cms/blog/posts`
2. Click en "Crear Entrada"
3. Rellenar slug y tags
4. Editar contenido con TipTap (próximamente)
5. Publicar cuando esté listo

### 4. Gestión de Imágenes

- **Featured Image**: Seleccionar imagen de la librería
- **Imágenes en contenido**: Subir directamente en el editor TipTap (próximamente)

---

## Sistema de Traducciones

El CMS usa el sistema híbrido existente:

| Tipo             | Cómo acceder                                  |
| ---------------- | --------------------------------------------- |
| UI Labels        | `locales/es/cms.json`                         |
| Contenido página | TranslationEntity con `entityName='Page'`     |
| Contenido blog   | TranslationEntity con `entityName='BlogPost'` |
| SEO              | Tabla `seo_metadata` con `pageId` + `lang`    |

### Guardar traducción de página

```bash
POST /api/v1/translations/dynamic
{
  "entityName": "Page",
  "entityId": "uuid-de-la-pagina",
  "lang": "es",
  "translations": {
    "title": "Título en español",
    "content": "<p>Contenido HTML...</p>",
    "excerpt": "Extracto breve"
  }
}
```

---

## Rendering Strategy

| Ruta              | Tipo      | Descripción                              |
| ----------------- | --------- | ---------------------------------------- |
| `/app/cms/**`     | SPA       | Admin panel - Client-side                |
| `/[lang]/page/**` | SSR       | Páginas CMS - Server-side para SEO       |
| `/[lang]/blog`    | SSG + SWR | Blog listing - Estático con revalidación |
| `/[lang]/blog/**` | SSG + SWR | Blog posts - Estático con revalidación   |

- **SSR**: Server-Side Rendering - Mejor para SEO dinámico
- **SSG**: Static Site Generation - Más rápido, regenera en build
- **SWR**: Stale-While-Revalidate - Caché con revalidación automática

---

## SEO y JSON-LD

Cada página pública incluye:

1. **Meta tags**: title, description, og:title, og:description, og:image
2. **Schema.org JSON-LD**:
   - WebSite para páginas landing
   - Article para blog posts
   - WebPage para páginas genéricas

---

## Sitemap

El sitemap se genera automáticamente usando `@nuxtjs/sitemap`:

- Fuentes configuradas en `nuxt.config.ts`
- Endpoints del backend proporcionan las URLs
- Actualización automática cada hora (SWR)

---

## Permisos

Solo usuarios con rol `admin` pueden:

- Crear, editar, eliminar páginas
- Crear, editar, eliminar posts
- Gestionar categorías
- Editar SEO

---

## Pendiente de Implementar

- [ ] Editor TipTap avanzado con imágenes inline
- [ ] Sistema de preview (nueva pestaña)
- [ ] Reorder drag & drop
- [ ] Upload de imágenes para TipTap
- [ ] Integración completa con traducciones
- [ ] Endpoints sitemap

---

## Comandos Útiles

```bash
# Generar migración
cd apps/back && pnpm migration:generate cms-initial-schema

# Ejecutar migración
cd apps/back && pnpm migration:run

# Development
pnpm dev

# Build
pnpm build
```
