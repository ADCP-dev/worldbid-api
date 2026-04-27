# CMS Tags Specification

## Purpose

Define the behavior of the new canonical TagEntity and its CRUD endpoints, supporting language-dependent names via the translation system.

## Requirements

### Requirement: Tag CRUD Endpoints

The system MUST expose REST endpoints for tag management under `/cms/tags`: `GET` (list), `POST` (create), `PATCH /:id` (update), and `DELETE /:id` (soft delete).

#### Scenario: Listing tags

- GIVEN three existing tags in the database
- WHEN `GET /cms/tags` is called
- THEN the response MUST contain all three tags with `id`, `name`, and `slug` fields

#### Scenario: Creating a tag

- GIVEN a request with `name: "Vue.js"` and `slug: "vuejs"`
- WHEN `POST /cms/tags` is called
- THEN the system MUST persist the tag
- AND the response MUST return the created tag with a generated UUID

#### Scenario: Updating a tag name

- GIVEN an existing tag with ID `tag-1` and `name: "Old Name"`
- WHEN `PATCH /cms/tags/tag-1` is called with `name: "New Name"`
- THEN the system MUST update the tag name
- AND the slug MUST remain unchanged unless explicitly provided

#### Scenario: Deleting a tag

- GIVEN an existing tag with ID `tag-1`
- WHEN `DELETE /cms/tags/tag-1` is called
- THEN the system MUST soft-delete the tag
- AND the tag MUST no longer appear in list responses

### Requirement: Tag Slug Uniqueness

The system MUST enforce that the `slug` field (also referred to as `textId`) is unique across all tags. Attempts to create or update a tag with a duplicate slug MUST be rejected.

#### Scenario: Rejecting duplicate slug on create

- GIVEN an existing tag with slug `nuxt`
- WHEN a create request with `slug: "nuxt"` is submitted
- THEN the system MUST respond with 409 Conflict

### Requirement: Tag Name Translation Support

The system MUST store the tag display name as a dynamic translation with `entityName: "Tag"` and `key: "name"`. The `name` field on TagEntity MAY serve as the default fallback.

#### Scenario: Fetching tag in current language

- GIVEN a tag with slug `nuxt` and an English translation `name: "Nuxt Framework"`
- WHEN the tag is retrieved with `lang: "en"`
- THEN the response MUST include `name: "Nuxt Framework"`
