# Delta for Translations

## ADDED Requirements

### Requirement: Translation Category Column

The system MUST add a nullable `category` column to the `translation` table. This column MAY be used to group translations logically (e.g., "seo", "content", "ui").

#### Scenario: Creating a translation with category

- GIVEN a translation create request with `category: "seo"`
- WHEN the request is processed
- THEN the persisted translation MUST include `category: "seo"`

#### Scenario: Filtering translations by category

- GIVEN translations with categories `"seo"` and `"content"`
- WHEN the translation list endpoint is called with `filter[category]=seo`
- THEN the response MUST contain only translations whose `category` equals `"seo"`

## MODIFIED Requirements

### Requirement: Entity-Scoped Translation Queries

The system MUST allow querying translations by `entityName` without requiring `entityId`. When `entityId` is omitted, the query MUST return all translations for that entity type.
(Previously: The pagination endpoint required both `entityName` and `entityId`; omitting either defaulted to `IS NULL`.)

#### Scenario: Fetching all page translations

- GIVEN translations with `entityName: "Page"` and various `entityId` values
- WHEN the list endpoint is called with `filter[entityName]=Page` and no `entityId`
- THEN the response MUST include all translations where `entityName` equals `"Page"`, regardless of `entityId`

#### Scenario: Fetching translations for a specific entity instance

- GIVEN translations with `entityName: "Page"` and `entityId: "page-1"`
- WHEN the list endpoint is called with `filter[entityName]=Page&filter[entityId]=page-1`
- THEN the response MUST include only translations for that specific page

#### Scenario: Backward-compatible null filtering

- GIVEN static translations with no `entityName` or `entityId`
- WHEN the list endpoint is called without `entityName` or `entityId` filters
- THEN the response MUST continue to return static translations as before
