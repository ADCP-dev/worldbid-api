# seo-json-ld-categorization

## Purpose

Typed registry for JSON-LD schema objects (Article, Product, Organization, BreadcrumbList) with factory pattern enabling reuse across CMS entities without hardcoded schema generation.

## Requirements

### Requirement: Schema Type Categorization

The system SHALL maintain a schema type registry that categorizes JSON-LD schemas into distinct types: `Article`, `Product`, `Organization`, `BreadcrumbList`.

Each schema type MUST be a factory function that accepts type-safe input parameters and returns a conformant JSON-LD object with `@context: 'https://schema.org'`.

### Requirement: Factory Pattern for Schema Generation

The system MUST provide a factory pattern where each schema type has a corresponding factory function callable with typed inputs. Factories MUST NOT require knowledge of the underlying schema structure.

#### Scenario: Generate Article schema for blog post

- GIVEN a blog post with slug `my-post`, publishedAt `2024-01-15`, and SEO meta with title `My Article`
- WHEN the Article schema factory is invoked
- THEN it returns an object with `@type: 'Article'`, `headline: 'My Article'`, `url` containing the post slug, and `datePublished` from publishedAt

#### Scenario: Generate BreadcrumbList schema

- GIVEN a path segments `['Home', 'Blog', 'My Article']`
- WHEN the BreadcrumbList schema factory is invoked
- THEN it returns an object with `@type: 'BreadcrumbList'` and `itemListElement` array with position-ordered items containing name and url for each segment

#### Scenario: Generate Organization schema

- GIVEN an organization name and URL
- WHEN the Organization schema factory is invoked
- THEN it returns an object with `@type: 'Organization'`, `name`, and `url`

### Requirement: Schema Registry Interface

The system SHOULD provide a registry interface that maps schema type names to their factory functions, enabling dynamic resolution without conditional branching.

### Requirement: Extensibility for Future Schema Types

The system MUST allow adding new schema types (e.g., `Product`, `Video`, `Event`) by implementing the factory interface without modifying existing factory functions.

## Schema Factories

| Schema Type | Factory Function | Required Inputs |
|-------------|------------------|-----------------|
| Article | `createArticleSchema(params)` | slug, publishedAt?, metaTitle, metaDescription?, ogImage? |
| BreadcrumbList | `createBreadcrumbSchema(pathSegments)` | array of {name, url} |
| Organization | `createOrganizationSchema(params)` | name, url |
| Product | `createProductSchema(params)` | name, description, image?, offers? |

## Out of Scope

- Implementation of Product schema details (offers, inventory) — placeholder only
- AI-powered schema generation — architecture placeholder
- Dynamic schema selection based on page content analysis