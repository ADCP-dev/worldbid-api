# Delta for CMS Pages

## ADDED Requirements

### Requirement: Page Section Field

The system MUST expose a `section` field on PageEntity that replaces the legacy `template` field. Valid values SHALL be `landing`, `blog`, `documentation`, and `store`.

#### Scenario: Creating a page with a section

- GIVEN no existing page with the requested slug
- WHEN an admin creates a page providing `section: "landing"`
- THEN the page MUST be persisted with `section` set to `landing`
- AND the page MUST be retrievable with that section value

#### Scenario: Rejecting an invalid section

- GIVEN a create-page request with `section: "invalid"`
- WHEN the request is validated
- THEN the system MUST reject the request with a 400 Bad Request error

### Requirement: Auto-Generated Slug

The system MUST automatically generate a URL-friendly slug in kebab-case from the page `name` field. The generated slug SHOULD be editable before persistence.

#### Scenario: Slug auto-generation on create

- GIVEN a page create request with `name: "About Us"`
- WHEN the request is processed
- THEN the system MUST derive the slug as `about-us`

#### Scenario: Preserving manually edited slug

- GIVEN a page create request with `name: "About Us"` and `slug: "custom-slug"`
- WHEN the request is processed
- THEN the system MUST persist the slug as `custom-slug`

## MODIFIED Requirements

### Requirement: Page Template Field Replaced by Section

The system MUST remove the `template` enum field and replace it with the `section` string field. Migration MUST preserve existing data by mapping `template` values to the closest equivalent `section` value where possible.
(Previously: PageEntity had a `template` enum with values `landing`, `generic`, `contact`.)

#### Scenario: Reading a migrated page

- GIVEN a page previously stored with `template: "landing"`
- WHEN the page is fetched after migration
- THEN the response MUST contain `section: "landing"`
- AND the response MUST NOT contain a `template` field

## REMOVED Requirements

### Requirement: Page Order Field

(Reason: The CMS UI no longer supports manual ordering of pages.)

#### Scenario: Creating a page without order

- GIVEN a page create request
- WHEN the request is processed
- THEN the system MUST persist the page without an `order` field
- AND any legacy `order` values in existing rows MUST be ignored by the application layer
