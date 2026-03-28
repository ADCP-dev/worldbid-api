# PRD: CMS Module - Content Management System

## Resumen Ejecutivo

Sistema de gestión de contenidos para FoundationMono que permite crear y administrar páginas CMS, blog posts con editor rico (TipTap), y categorías. El sistema soporta traducciones dinámicas por idioma, SEO completo (JSON-LD, OG tags, Twitter Cards), y subida de imágenes vinculada a entidades.

---

## 1. Fundamentos y Estrategia

### 1.1 Objetivo y Visión

Proveer un CMS admin completo para que editores de contenido puedan crear/editar páginas y blog posts con soporte multi-idioma, SEO optimizado, y gestión de medios integrada. El editor rico permite escribir contenido conformatación, imágenes inline (vinculadas a la entidad), y previsualización en tiempo real.

### 1.2 User Personas

#### Editor de Contenido

- **Rol**: Crea y mantiene contenido del sitio
- **Demografía**: No técnico, accede desde desktop
- **Pain points**: Necesita crear contenido sin depender de developers, quiere previsualizar antes de publicar, gestiona contenido en múltiples idiomas
- **Cómo mide éxito**: Contenido publicado rápidamente, correctamente formateado y traducido, SEO optimizado
- **Tecnología**: Desktop browser, admin SPA

#### Administrador

- **Rol**: Supervisa contenido, gestiona categorías y medios
- **Demografía**: Usuario técnico intermedio
- **Pain points**: Necesita control sobre qué contenido es público, gestión centralizada de medios
- **Cómo mide éxito**: Sitio organizado, imágenes vinculadas a entidades para cleanup automático, contenido traducido
- **Tecnología**: Desktop browser, admin SPA

### 1.3 KPIs

| KPI                    | Meta                                                    | Cómo medir                               |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------- |
| Tiempo de publicación  | < 5 min desde creación hasta público                    | Timestamp creation vs publish            |
| Traducciones guardadas | 100% de contenido editable en todos los idiomas activos | Query tabla translations                 |
| Imágenes vinculadas    | 100% de imágenes en content linked to entity            | Query FileEntity con entityName/entityId |
| Errores de upload      | < 1% tasa de error                                      | Logs de API /cms/media/upload            |

---

## 2. Funcionalidad

### 2.1 Estructura de Módulos

```
CMS Module
├── Pages (CRUD páginas CMS)
├── Blog
│   ├── Posts (CRUD + preview + publish)
│   └── Categories (CRUD)
├── Media (upload con entity linking)
├── SEO (metadata por idioma)
└── Sitemap (generación automática)
```

### 2.2 Blog Posts

#### User Flows

**Crear Post:**

```
1. Usuario → /app/cms/blog/posts/create
2. Usuario completa: slug, título, contenido (TipTap), excerpt, tags, categoría
3. Usuario selecciona idioma del contenido (dinámico desde tabla lang)
4. Usuario hace click en "Crear"
5. Sistema → Crea post como draft → redirect a /app/cms/blog/posts/{id}/edit
6. En edit: usuario puede cambiar idioma y editar traducciones independently
7. Usuario guarda → translations se guardan por entityId + langCode
```

**Subir Imagen en Editor:**

```
1. Usuario → drag & drop o paste o click en botón imagen
2. Frontend → POST /api/v1/cms/media/upload (con entityName=BlogPost, entityId={postId}, context=content)
3. Backend → FilesLocalService.create() → guarda archivo físico + FileEntity con entityName/entityId
4. Backend → responde { url, id, name, entityName, entityId }
5. Frontend → Inserta <img src={url}> en editor TipTap
```

**Preview Post:**

```
1. Usuario → click en icono preview (lista de posts)
2. Sistema → GET /api/v1/cms/blog/posts/{id}/preview
3. Frontend → renderiza página de preview con traducciones cargadas por lang
4. Selector de idioma permite cambiar entre traducciones
```

**Ver Post Publicado:**

```
1. Usuario → click en icono external link (solo si isPublished=true)
2. Abre /{lang}/blog/{slug} en nueva pestaña
```

#### API Endpoints

```
POST   /api/v1/cms/blog/posts                    → Crear post
GET    /api/v1/cms/blog/posts                    → Lista (admin, filtra por published)
GET    /api/v1/cms/blog/posts/:id               → Obtener post
GET    /api/v1/cms/blog/posts/:id/preview        → Preview (sin requirement isPublished)
PATCH  /api/v1/cms/blog/posts/:id                → Actualizar post
PATCH  /api/v1/cms/blog/posts/:id/publish        → Toggle published status
DELETE /api/v1/cms/blog/posts/:id               → Borrar post + sus archivos asociados

GET    /api/v1/cms/blog/posts/public             → Lista posts publicados ( público)
GET    /api/v1/cms/blog/posts/public/:slug      → Post público por slug

GET    /api/v1/translations/dynamic/:lang/:entityName/:entityId
       → Respuesta: { "title": { "value": "..." }, "content": { "value": "..." } }

POST   /api/v1/translations
       Body: { section, key, content, langCode, entityName, entityId }
       → langCode es string ("es", "en") - lookup automático a langId
```

### 2.3 Traducciones (Dynamic Translations)

#### Formato de Respuesta GET /translations/dynamic/:lang/:entityName/:entityId

```json
{
  "title": { "value": "Título del post" },
  "content": { "value": "<p>Contenido HTML</p>" },
  "excerpt": { "value": "Resumen del post" }
}
```

#### Formato para crear POST /translations

```json
{
  "key": "title",
  "content": "Título del post",
  "langCode": "es",
  "entityName": "BlogPost",
  "entityId": "uuid-del-post"
}
```

_Nota: `section` es opcional para traducciones dinámicas (con entityName/entityId). Default: "dynamic"_

````

**Reglas:**

- `langCode` es string (ej: "es", "en") - el servicio hace lookup a `langId` internamente
- Si `langCode` no existe → error 404
- Si no se provee `langCode` ni `langId` → error 400
- Backwards compatibility: si se pasa `langId` (number) funciona igual
- `section` es opcional cuando se usa `entityName`/`entityId` (dynamic translations); default: "dynamic"
- Para traducciones estáticas (sin entity), `section` es requerido

### 2.4 Idiomas (Dynamic Language Selector)

Los idiomas se cargan dinámicamente desde `/api/v1/translations/langs` (configurado en nuxt.config.ts via hook `i18n:registerModule`).

```typescript
// En componentes Vue
const { locale, locales } = useI18n();

// locales.value = [{ code: "es", name: "Español", flagCode: "es" }, ...]
````

**Selector de idioma debe:**

- Mostrar todos los idiomas activos (isActive: true)
- Usar `locale.code` como valor
- Hacer fetch de traducciones al cambiar: `GET /translations/dynamic/{newLang}/BlogPost/{entityId}`

### 2.5 SEO

#### Página Pública Blog Post

```typescript
// JSON-LD BlogPosting schema
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": title,
  "description": excerpt,
  "image": ogImage,
  "url": canonicalUrl,
  "datePublished": publishedAt,
  "author": { "@type": "Person", "name": author }
}
```

#### OG Tags

```
og:title = metaTitle || title
og:description = metaDescription || excerpt
og:image = ogImage || featuredImage
og:url = canonicalUrl
twitter:card = summary_large_image
```

### 2.6 Upload de Imágenes con Entity Linking

**Flujo:**

1. Imagen se sube via `POST /cms/media/upload`
2. Backend recibe: file (multipart), entityName, entityId, context
3. FilesLocalService.create() guarda:
   - Archivo físico en `./files/public/{userId}/{entityName}/{entityId}/{context}/{filename}`
   - FileEntity con: path, name, type, size, isPublic, entityName, entityId, context
4. Respuesta: `{ url: fullUrl, id, name, entityName, entityId }`

**Estructura de path según metadata:**

- entityName + entityId + context: `{userId}/{entityName}/{entityId}/{context}`
- entityName + entityId: `{userId}/{entityName}/{entityId}`
- context only: `{userId}/{context}`
- No metadata: `{userId}`

**Beneficio:** Cuando se borra el entity (ej: BlogPost), se borran automáticamente sus imágenes asociadas.

---

## 3. Requisitos Técnicos

### 3.1 API Design

#### Media Upload

```
POST /api/v1/cms/media/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Body (form-data):
  - file: Binary
  - entityName?: string (e.g., "BlogPost", "Page")
  - entityId?: string (UUID)
  - context?: string (e.g., "content", "featured")
  - isPublic?: boolean (default: true)

Response 200:
{
  "url": "http://localhost:3001/api/v1/files/public/uuid",
  "id": "uuid",
  "name": "image.png",
  "entityName": "BlogPost",
  "entityId": "uuid-del-post"
}
```

#### Translations

```
GET /api/v1/translations/dynamic/:lang/:entityName/:entityId
→ { "key": { "value": "translated text" } }

POST /api/v1/translations
Body: { section, key, content, langCode, entityName, entityId }
→ TranslationEntity created
```

### 3.2 Data Model

#### FileEntity (extendida para CMS)

```typescript
{
  id: string; // UUID
  path: string; // "/api/v1/files/public/uuid"
  name: string; // "image.png"
  type: string; // "image/png"
  size: number; // bytes
  isPublic: boolean; // true
  entityName: string; // "BlogPost"
  entityId: string; // UUID del post
  context: string; // "content" | "featured"
}
```

#### TranslationEntity

```typescript
{
  id: number;
  section: string; // namespace (ej: "blog.post")
  key: string; // "title", "content", "excerpt"
  content: string; // texto traducido
  langId: number; // FK → lang.id
  entityName: string; // "BlogPost" (nullable para estáticas)
  entityId: string; // UUID (nullable)
}
```

### 3.3 Frontend Components

#### RichEditorAdvanced.vue

**Props:**

```typescript
interface Props {
  modelValue?: string;
  entityName?: string; // "BlogPost", "Page"
  entityId?: string; // UUID
}
```

**Funcionalidades:**

- TipTap v3 con extensions: StarterKit, Link, Image, Highlight, TextAlign, Typography
- Toolbar: bold, italic, strike, code, highlight, headings (H1-H6), lists, blockquote, code block, text alignment, links, images, tables, horizontal rule, undo/redo
- Drag & drop upload → POST /cms/media/upload con entityName/entityId
- Paste image upload → mismo endpoint
- File picker button (reemplaza prompt de URL)

#### Language Selector

```vue
<select v-model="currentLang" @change="loadTranslations">
  <option v-for="loc in locales" :key="loc.code" :value="loc.code">
    {{ loc.name }}
  </option>
</select>
```

- Usa `useI18n().locales` que carga idiomas dinámicamente
- Al cambiar idioma → fetchTranslations(entityId, newLang)

### 3.4 Delete Cascade

Cuando se elimina un BlogPost:

1. BlogPostsService.remove() busca files con `entityName: 'BlogPost'` y `entityId: postId`
2. Los borra via FilesService.delete()
3. Luego borra el BlogPost de la DB
4. El physical file se borra via GlobalFileCleanupSubscriber

---

## 4. Rutas y Estructura

### 4.1 Rutas Frontend

```
/app/cms/**                    → SSR: false (SPA)
/[lang]/page/**               → SSR: true
/[lang]/blog/**               → SWR: 3600

/app/cms/blog/posts           → Lista de posts
/app/cms/blog/posts/create    → Crear post (redirect a edit)
/app/cms/blog/posts/:id/edit → Editar post
/app/cms/blog/posts/:id/preview → Preview post
/app/cms/blog/categories      → Lista de categorías
```

### 4.2 Archivos Clave

```
apps/front/modules/cms/
├── composables/
│   ├── useCmsPages.ts
│   ├── useCmsBlogPosts.ts     ← fetchPreview(), langCode support
│   └── useCmsCategories.ts
├── components/cms/
│   └── RichEditorAdvanced.vue  ← entityName/entityId props, file picker
├── pages/
│   ├── (app)/cms/
│   │   ├── index.vue
│   │   └── blog/
│   │       ├── posts/
│   │       │   ├── index.vue         ← Preview + View links
│   │       │   ├── create.vue         ← Lang selector
│   │       │   ├── [id]/
│   │       │   │   └── edit.vue       ← Lang selector + entity linking
│   │       │   └── preview/
│   │       │       └── [id]/index.vue ← Preview page
│   │       └── categories/
│   └── (public)/[lang]/
│       └── blog/
│           ├── index.vue
│           └── [slug].vue      ← Full SEO + JSON-LD

apps/back/src/modules/cms/
├── blog/
│   ├── posts/
│   │   ├── posts.service.ts   ← delete() con cascade de files
│   │   └── posts.controller.ts
│   └── categories/
└── media/
    └── media.controller.ts    ← Usa FilesLocalService + entity params

apps/back/src/modules/translations/
├── translations.service.ts    ← langCode support, {key: {value}} response
└── dto/
    └── create-translation.dto.ts  ← langCode field añadido
```

---

## 5. Métricas y Validación

### 5.1 Tests de Aceptación

| #   | Escenario                  | Validación                                                     |
| --- | -------------------------- | -------------------------------------------------------------- |
| 1   | Crear post con imagen      | Imagen vinculada a entityName=BlogPost, entityId={postId}      |
| 2   | Cambiar idioma en edit     | Traducciones correctas cargadas, guardar funciona con langCode |
| 3   | Preview post draft         | Muestra contenido aunque isPublished=false                     |
| 4   | Ver post publicado         | Enlace abre /{lang}/blog/{slug} correctamente                  |
| 5   | Borrar post                | Archivos asociados se borran de DB y filesystem                |
| 6   | Upload imagen sin entityId | Funciona (entityName/entityId opcionales)                      |

### 5.2 Checklist de Implementación

- [x] RichEditorAdvanced tiene props entityName y entityId
- [x] Upload imagen pasa entityName/entityId al backend
- [x] Backend/media/upload guarda con entity linking
- [x] GET /translations/dynamic devuelve { key: { value } }
- [x] POST /translations acepta langCode
- [x] Selector de idiomas usa useI18n().locales (dinámico)
- [x] Preview page funciona para drafts
- [x] Link "Ver" solo aparece si isPublished=true
- [x] Delete post borra archivos asociados
- [x] SEO completo en páginas públicas (JSON-LD, OG, Twitter)

### 5.3 Notas de Verificación

| Item                                                                  | Estado | Verificado                                                             |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Controller endpoints (create, list, preview, update, publish, delete) | ✅     | PostsController tiene todos los endpoints                              |
| Delete cascade                                                        | ✅     | BlogPostsService.remove() borra archivos asociados via FilesService    |
| Media entity linking                                                  | ✅     | MediaController usa FilesLocalService.create() con entityName/entityId |
| Translations format                                                   | ✅     | Backend devuelve `{ key: { value } }`                                  |
| langCode support                                                      | ✅     | createTranslation() acepta langCode o langId                           |
| Language selector dinámico                                            | ✅     | Usa useI18n().locales (cargado via hook i18n:registerModule)           |
| Preview page                                                          | ✅     | /preview/[id]/index.vue existe con selector de idioma                  |
| View link                                                             | ✅     | Solo visible si isPublished=true en posts/index.vue                    |

---

## Aprobaciones

- [ ] Product Owner
- [ ] Tech Lead
- [ ] Designer (si aplica)
