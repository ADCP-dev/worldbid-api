---
id: "translations"
name: "i18n Translations"
type: "module"
parent: null
dependencies: []
conventions:
  - "Hybrid approach: database-backed management + JSON files for performance"
  - "Static labels managed via DB but backed by JSON (Lang + Translation entities)"
  - "Dynamic content uses polymorphic Translation entity (entityName + entityId)"
  - "Section field uses colon separator (:) for subfolder organization"
  - "seed:run syncs new JSON keys to DB without overwriting existing values"
  - "CLI tool (i18n:add) for scaffolding new translation keys interactively"
  - "Dev mode globe icon exposes raw keys and enables inline editing"
  - "Dynamic content consumed via GET /api/v1/translations/dynamic/:lang/:entityName/:entityId"
entities:
  - "Lang"
  - "Translation"
---

# i18n Translations

## Overview

A hybrid translation system handling both static UI labels and dynamic entity content. Static labels are backed by JSON files for performance but managed via the database for non-technical admins. Dynamic content (product descriptions, article titles, SEO metadata) uses polymorphic relationships on the `Translation` entity. This approach combines the developer experience of file-based i18n with the flexibility of database-backed management.

## Architecture

### Hybrid Model

```mermaid
flowchart LR
    subgraph "Static Translations"
        JSON[JSON Files<br/>locales/en/base/auth.json]
        DB_STATIC[(Translation Entity<br/>entityName=null)]
        JSON -->|seed:run syncs| DB_STATIC
        DB_STATIC -->|generate JSON| JSON
    end

    subgraph "Dynamic Translations"
        ENTITY[Entity: BlogPost, Page, etc.]
        DB_DYNAMIC[(Translation Entity<br/>entityName=BlogPost)]
        ENTITY --> DB_DYNAMIC
    end

    subgraph "Consumption"
        FE[Frontend UI] -->|$t() + API| JSON
        API[API Consumer] -->|GET /translations/dynamic| DB_DYNAMIC
    end
```

### Core Entities

#### Lang (`lang`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment |
| `code` | VARCHAR(5) | ISO 639-1 code (`en`, `es`, `pt`) |
| `name` | VARCHAR(50) | Display name (`English`, `Español`) |
| `isActive` | BOOLEAN | Toggle visibility in language selector |
| `createdAt` | TIMESTAMP | Auto-generated |
| `updatedAt` | TIMESTAMP | Auto-updated |

#### Translation (`translation`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment |
| `section` | VARCHAR(100) | Namespace (e.g., `base:auth.loginPage`) |
| `key` | VARCHAR(100) | Specific identifier (e.g., `title`, `description`) |
| `content` | TEXT | The translated text |
| `langId` | INT (FK → lang.id) | Language reference |
| `entityName` | VARCHAR(100) (nullable) | `null` = static, otherwise entity type (`Product`, `BlogPost`) |
| `entityId` | VARCHAR(100) (nullable) | `null` = static, otherwise entity UUID |
| `createdAt` | TIMESTAMP | Auto-generated |
| `updatedAt` | TIMESTAMP | Auto-updated |

### Static vs Dynamic Translations

| Aspect | Static | Dynamic |
|--------|--------|---------|
| `entityName` | `null` | Set (e.g., `'BlogPost'`, `'Page'`) |
| `entityId` | `null` | Set (entity UUID) |
| Storage | JSON files + DB | DB only |
| Frontend access | `$t('key')` via vue-i18n | `GET /api/v1/translations/dynamic/...` |
| Backend access | NestJS `I18nService` | Direct service call |
| Managed by | Developers (JSON) + Admins (UI) | Admins (UI) |

### Subfolder Convention (`:` separator)

The `section` field uses a colon separator to organize JSON files into subdirectories:

**Format**: `[folderPath:]fileSection.keyPath`

| DB `section` value | Output file | Vue i18n key |
|--------------------|-------------|--------------|
| `landing.hero` | `locales/en/landing.json` | `$t('landing.hero.title')` |
| `base:auth.loginPage` | `locales/en/base/auth.json` | `$t('base.auth.loginPage.title')` |
| `base:nav` | `locales/en/base/nav.json` | `$t('base.nav.general')` |
| `base.admin:users.form` | `locales/en/base/admin/users.json` | `$t('base.admin.users.form.title')` |

**Rules:**
- Everything **before** `:` → subfolder path (dots become path separators)
- Everything **after** `:` → JSON filename + key path within it
- If there is **no colon**, the file is written at the lang root (e.g., `landing.json`)

## API / Public Interface

### Dynamic Translations

**Get dynamic translations for an entity:**

```http
GET /api/v1/translations/dynamic/:lang/:entityName/:entityId
```

Response:

```json
{
  "title": { "value": "Translated title" },
  "content": { "value": "<p>Translated HTML content</p>" },
  "excerpt": { "value": "Translated excerpt" }
}
```

**Create/update a single translation:**

```http
POST /api/v1/translations
Content-Type: application/json

{
  "key": "title",
  "content": "Translated text",
  "langCode": "es",
  "entityName": "BlogPost",
  "entityId": "uuid-del-post",
  "section": "dynamic"
}
```

**Generate JSON files from DB:**

```http
POST /api/v1/translations/generate
```

### Available Languages

```http
GET /api/v1/translations/langs
```

Response:

```json
[
  { "code": "en", "name": "English", "isActive": true },
  { "code": "es", "name": "Español", "isActive": true }
]
```

## Workflows

### 1. Development (JSON → DB)

Developers add keys to JSON files in `apps/front/locales/[lang]/` or `apps/back/src/i18n/`. When seeds run:

```bash
npm run seed:run
```

The `TranslationSeedService`:
1. Reads JSON files **recursively** (including subdirectories)
2. Flattens structure, encoding folder path into `section` with `:` separator
3. Checks DB for existing keys (by `lang`, `section`, `key`)
4. **Inserts only new keys** — existing DB values are preserved

### 2. Admin UI Management

Access at `/admin/translations`:

- **Grouping**: Automatically grouped by App Context + Section + Key
- **Creating**: "Nueva Traducción" button establishes new keys from UI
- **Editing**: Click accordion row → reveals all active languages → saves `onBlur`
- **Deleting**: Clear the textarea → removes from DB

### 3. CLI Tool (`i18n:add`)

```bash
npm run i18n:add
```

From `apps/back/`, this interactive script prompts for:
- App Context (`front` / `back`)
- `section` (use `:` convention for subfolders)
- `key`
- Content for each available language

### 4. JSON Generation (DB → JSON)

To update frontend files with DB changes:

**Via UI:** Click "Generate JSON" at `/admin/translations`

**Via API:** `POST /api/v1/translations/generate`

The service:
1. Fetches all static translations from DB
2. Groups by language and target application
3. Parses `:` separator to determine output subfolder
4. Writes structured JSON files

### 5. Dev Mode (Inline Editing)

While developing (`NODE_ENV=development`), a floating **globe icon** appears in the bottom-right corner:

- Click toggles `i18n-show-keys` mode
- All `$t()` calls show raw keys instead of translated text (e.g., `base.auth.loginPage.description` appears in buttons)
- Keys become **clickable** → opens the **Interactive Translation Editor** modal
- The modal shows all active language values for that key
- Pre-fills textareas with fallback text if key doesn't exist in DB yet
- "Guardar y Sincronizar" saves to DB, regenerates JSON, and reloads the page

### 6. Adding a New Language

1. Go to `/admin/languages` and create the language (set "Active")
2. Add the language's ISO code to `i18n.locales` array in `apps/front/nuxt.config.ts`
3. The language automatically appears in the translation tables and frontend selector

## File Structure

### Backend (`apps/back/src/i18n/`)

```
src/i18n/
├── en/
│   └── common.json    # common.confirmEmail, common.resetPassword...
└── es/
    └── common.json
```

### Frontend (`apps/front/locales/`)

```
locales/
├── en/
│   ├── landing.json
│   └── base/
│       ├── auth.json
│       ├── nav.json
│       └── ...
├── es/
│   ├── landing.json
│   └── base/
│       ├── auth.json
│       ├── nav.json
│       └── ...
└── ...
```

## Dependencies

None — this is a foundational module that other modules (like [CMS](../extensions/cms.md)) depend on for multilingual content.

## Conventions

| Convention | Rule |
|------------|------|
| Backend translations | `apps/back/src/i18n/` |
| Frontend translations | `apps/front/locales/` |
| Key format | `section:key` with optional subfolder prefix using `:` |
| Seed preservation | `seed:run` inserts only new keys; existing DB values preserved |
| Dynamic content | Accessed via `GET /api/v1/translations/dynamic/:lang/:entityName/:entityId` |
| Language resolution | `langCode` (string) preferred; `langId` (number) supported for backwards compatibility |
| Section requirement | Required for static, optional for dynamic (default: `"dynamic"`) |

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `APP_HEADER_LANGUAGE` | `x-custom-lang` | HTTP header used to detect language for backend emails |

## Rationale

The hybrid approach combines the best of both worlds: **developers** get fast iteration with JSON files and hot-reload, while **non-technical admins** get a UI to manage translations without touching code. The polymorphic Translation entity (`entityName` + `entityId`) enables dynamic content translation for any entity type without schema changes. The `section` colon convention provides automatic file organization — no manual file management needed when adding new sections. The dev mode inline editor dramatically speeds up translation workflows by showing context (which UI element maps to which key) and allowing edits directly on the page.
