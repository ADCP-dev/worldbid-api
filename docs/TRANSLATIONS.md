# Hybrid Translation System

This document outlines the architecture and workflow of the Hybrid Translation System in Foundation.

## Architecture

The system is designed to handle two types of content translation:
1.  **Static UI Labels**: Standard application text (buttons, headers, form labels). These are backed by JSON files for performance but managed in the database.
2.  **Dynamic Entity Content**: Translations for database records (e.g., Product descriptions, Article titles). These use a polymorphic relationship in the database.

### Database Schema

Two main entities manage the translations:

**Lang (`lang`)**
- `code`: ISO code (e.g., `en`, `es`).
- `name`: Display name.
- `isActive`: Toggle availability.

**Translation (`translation`)**
- `section`: Namespace for organization (e.g., `landing.hero`).
- `key`: Specific identifier (e.g., `title`).
- `content`: The translated text.
- `lang`: Foreign key to `Lang`.
- `entityName`: (Nullable) Name of the related entity (e.g., `Product`).
- `entityId`: (Nullable) ID of the related entity.

If `entityName` and `entityId` are `null`, the translation is considered **Static**. Otherwise, it is **Dynamic**.

## Workflows

### 1. Development (JSON -> DB)

Developers add new translation keys directly to the JSON files located in `apps/back/src/i18n/*.json`.

When the seed command runs:
```bash
npm run seed:run
```
The `TranslationSeedService`:
1.  Reads the JSON files.
2.  Flattens the structure (e.g., `{"landing": {"hero": "Title"}}` -> `landing.hero = Title`).
3.  Checks the database for existing keys (by `lang`, `section`, `key`).
4.  **Inserts only new keys.** Existing database values are preserved to respect admin edits.

### 2. Management (DB -> Admin UI)

Admins can manage translations via the Frontend Admin Panel:
- **Languages**: Add/Edit/Delete languages.
- **Translations**: CRUD operations for static and dynamic translations.

Access the panel at: `/admin/translations`

### 3. Deployment / Static Generation (DB -> JSON)

To update the frontend with changes made in the Admin UI (for static labels), the JSON files must be regenerated.

**API Endpoint:** `POST /api/v1/translations/generate`

This service:
1.  Fetches all **static** translations from the DB.
2.  Groups them by Language and Section.
3.  Writes the structured JSON files to:
    - `apps/back/src/i18n/` (Source of truth for next seed)
    - `apps/front/locales/` (Immediate frontend consumption)

### 4. Dynamic Content Consumption

For dynamic content (e.g., a product description), use the API directly:

**Endpoint:** `GET /api/v1/translations/dynamic/:lang/:entityName/:entityId`

Response:
```json
{
  "description": "Translated product description",
  "name": "Translated Product Name"
}
```

## Frontend Usage

### Static Labels
Use the standard Nuxt i18n features:
```vue
<template>
  <h1>{{ $t('landing.hero.title') }}</h1>
</template>
```

### Dynamic Content
Use the `useTranslations` composable:
```ts
const { getTranslationsForEntity } = useTranslations();
const content = await getTranslationsForEntity('Product', '1', 'es');
```

## Adding a New Language

1.  Create a new JSON file in `apps/back/src/i18n/` (e.g., `fr.json`).
2.  Add it to `apps/front/nuxt.config.ts` in the `i18n.locales` array.
3.  Run `npm run seed:run` to register it in the database.
