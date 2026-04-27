# PRD: CMS Reorganization

## Overview
Reorganización completa del módulo CMS con mejoras en UX/UI, nuevas funcionalidades y unificación de pantallas.

## 1. Base de Datos

### 1.1 Nueva columna en tabla `translations`
- **`category`** (string, nullable): Categoría de la traducción para agrupación

## 2. Reorganización de Páginas

### 2.1 Estructura unificada (sin tabs)
Eliminar tabs "Contenido" y "Configuración". Todo en una sola pantalla.

### 2.2 Campos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Selector de idioma** | Dropdown | Mantener existente |
| **Nombre** | Text input | Reemplaza "Título". Slug se genera automáticamente en kebab-case |
| **Slug** | Text input | Auto-generado desde Nombre, editable |
| **SEO** | Select | Secciones: General, Home, Product, Article, etc. |
| **Sección** | Select | Reemplaza "Plantilla": landing, blog, documentación, tienda |
| **Traducciones** | Table | Tabla de traducciones filtradas por entityName |

### 2.3 Eliminaciones
- ❌ Extracto
- ❌ Contenido (páginas no tienen contenido)
- ❌ Orden
- ❌ Tab Configuración

### 2.4 Dependencias de idioma
- Slug varía según idioma seleccionado
- SEO varía según idioma seleccionado
- Traducciones se muestran filtradas por entityName (no entityId)

## 3. Blog

### 3.1 Estructura
Similar a páginas con contenido:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Selector de idioma** | Dropdown | Mantener existente |
| **Título** | Text input | Slug se genera automáticamente |
| **Slug** | Text input | Auto-generado desde Título |
| **Etiquetas** | FormMultipleSelect | Selector múltiple de tags |
| **Contenido** | RichEditor | Dependiente del idioma seleccionado |
| **Previsualizar** | Button | Abre modal fullscreen |
| **Categoría** | Select | Categoría del blog post |
| **Imagen destacada** | Upload | Subida a CDN (Backblaze/BunnyCDN/Cloudflare) |
| **Traducciones** | Table | Tabla filtrada por entityName |

### 3.2 Modal de previsualización
- Fullscreen modal
- Edición en tiempo real del contenido
- Vista previa del post renderizado

### 3.3 Eliminaciones
- ❌ Extracto

## 4. Categorías

### 4.1 Estructura
| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Selector de idioma** | Dropdown | Mantener existente |
| **Nombre** | Text input | Nombre de la categoría |
| **Slug** | Text input | Auto-generado |
| **Descripción** | TextArea | Opcional, dependiente del idioma |
| **Traducciones** | Table | Tabla filtrada por entityName |

## 5. Etiquetas (Nueva página)

### 5.1 Estructura
| Campo | Tipo | Descripción |
|-------|------|-------------|
| **Selector de idioma** | Dropdown | Mantener existente |
| **Nombre** | Text input | Nombre visible de la etiqueta |
| **ID de texto** | Text input | Identificador único (slug) |
| **Traducciones** | Table | Tabla filtrada por entityName |

## 6. Componentes Reutilizados

### 6.1 Tabla de Traducciones
- Usar componente Table existente del sistema
- Filtrar por `entityName` (Page, BlogPost, Category, Tag)
- Mostrar solo traducciones asociadas a la entidad actual

### 6.2 FormMultipleSelect
- Usar componente creado en form-components
- Para etiquetas en blog posts

## 7. Tecnologías

### 7.1 Data Fetching
- **TanStack Query (Vue Query)** en lugar de fetch directo
- Cache, invalidación, loading states manejados por TanStack

### 7.2 Validación
- **Zod** para validación de formularios
- Schemas para cada entidad (Page, BlogPost, Category, Tag)

## 8. Backend Requirements

### 8.1 Nuevos endpoints necesarios
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/cms/tags` | GET | Listar etiquetas |
| `/cms/tags` | POST | Crear etiqueta |
| `/cms/tags/:id` | PATCH | Actualizar etiqueta |
| `/cms/tags/:id` | DELETE | Eliminar etiqueta |
| `/cms/blog/posts/:id/preview` | GET | Previsualizar post |

### 8.2 Modificaciones
- Columna `category` en tabla translations
- Ajustar entityName para nuevas entidades (Tag)

## 9. Flujo de Slug
```
Nombre/Título input → onChange → kebab-case(slug) → Slug input
```

## 10. Dependencias de Idioma
- Todos los campos textuales varían según idioma seleccionado
- Slug es por idioma
- SEO metadata es por idioma
- Contenido es por idioma
- Traducciones se filtran por entityName + idioma actual

---

## Checklist de Implementación

### Fase 1: Base de datos
- [ ] Migration: add category column to translations
- [ ] Update TranslationEntity

### Fase 2: Backend
- [ ] Tag entity, service, controller
- [ ] Tag CRUD endpoints
- [ ] Preview endpoint for blog posts
- [ ] Update existing entities (remove order, add section)

### Fase 3: Frontend - TanStack Query Setup
- [ ] Install @tanstack/vue-query
- [ ] Create query keys
- [ ] Create hooks for pages, blog, categories, tags

### Fase 4: Frontend - Zod Validation
- [ ] Create schemas for Page, BlogPost, Category, Tag
- [ ] Integrate with forms

### Fase 5: Frontend - Pages Redesign
- [ ] Unified single-screen layout
- [ ] Name field with auto-slug
- [ ] Section selector
- [ ] SEO selector
- [ ] Translations table integration

### Fase 6: Frontend - Blog Redesign
- [ ] Similar layout to pages
- [ ] Tags with FormMultipleSelect
- [ ] Content with language preview
- [ ] Fullscreen preview modal
- [ ] Image upload to CDN
- [ ] Category selector

### Fase 7: Frontend - Categories
- [ ] Name, slug, description fields
- [ ] Language-dependent

### Fase 8: Frontend - Tags (New)
- [ ] Name, text ID fields
- [ ] Language selector
- [ ] Translations table

### Fase 9: Testing
- [ ] Test all CRUD operations
- [ ] Test language switching
- [ ] Test slug generation
- [ ] Test translations filtering