# Delta for CMS Categories

## ADDED Requirements

### Requirement: Category Slug Auto-Generation

The system MUST automatically generate a URL-friendly slug in kebab-case from the category `name` field. The slug MAY be manually overridden before persistence.

#### Scenario: Auto-generating a category slug

- GIVEN a category create request with `name: "JavaScript"`
- WHEN the request is processed
- THEN the system MUST derive the slug as `javascript`

#### Scenario: Enforcing slug uniqueness

- GIVEN an existing category with slug `javascript`
- WHEN a second category is created with `name: "JavaScript"` and no explicit slug
- THEN the system MUST reject the request with a 409 Conflict error

## MODIFIED Requirements

### Requirement: Category Description Becomes Language-Dependent

The system MUST remove the `description` column from BlogCategoryEntity and persist category descriptions as dynamic translations keyed by `entityName: "Category"` and the category ID. The API MUST hydrate the description for the requested language on read.
(Previously: BlogCategoryEntity stored `description` as a plain text column directly on the entity.)

#### Scenario: Reading a category in Spanish

- GIVEN a category with ID `cat-1` and a Spanish translation entry where `key: "description"`, `content: "Categoría de tutoriales"`
- WHEN the category is fetched with `lang: "es"`
- THEN the response MUST include `description: "Categoría de tutoriales"`

#### Scenario: Reading a category with missing translation

- GIVEN a category with no description translation for the requested language
- WHEN the category is fetched
- THEN the response MUST include `description: null`

#### Scenario: Updating a category description

- GIVEN an update request for category `cat-1` with `description: "Updated desc"` and `lang: "en"`
- WHEN the request is processed
- THEN the system MUST create or update the translation row for `entityName: "Category"`, `entityId: "cat-1"`, `key: "description"`, `lang: "en"`
