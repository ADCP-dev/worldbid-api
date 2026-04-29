# zod-validation Specification

## Purpose

Define Zod schema validation for all CMS forms.

## Requirements

### Requirement: Zod schemas for CMS entities

The system MUST define Zod schemas for Page, BlogPost, Category, and Tag forms.

#### Scenario: Page form is validated

- GIVEN a user submits a page form
- WHEN validation runs
- THEN the schema MUST enforce that `name` and `slug` are non-empty strings
- AND `section` and `seo` are valid enum values

#### Scenario: BlogPost form is validated

- GIVEN a user submits a blog post form
- WHEN validation runs
- THEN the schema MUST enforce that `title` and `slug` are non-empty strings
- AND `category` is a valid reference
- AND `tags` is an array of valid tag references

#### Scenario: Category form is validated

- GIVEN a user submits a category form
- WHEN validation runs
- THEN the schema MUST enforce that `name` and `slug` are non-empty strings
- AND `description` is optional

#### Scenario: Tag form is validated

- GIVEN a user submits a tag form
- WHEN validation runs
- THEN the schema MUST enforce that `name` and `textId` are non-empty strings

### Requirement: Schema integration with forms

Zod schemas MUST be integrated with the form components so that validation errors are displayed inline.

#### Scenario: Validation error is shown

- GIVEN a required field is left empty
- WHEN the user attempts to submit
- THEN the form MUST display an inline error message
- AND submission MUST be prevented

### Requirement: Slug validation

Zod schemas MUST validate that `slug` values conform to kebab-case format.

#### Scenario: Invalid slug is rejected

- GIVEN a user enters a slug with spaces or special characters
- WHEN validation runs
- THEN the schema MUST reject the value
- AND display an appropriate error message
