# cms-seo-metadata (Delta)

## Purpose

Extend SeoMetadataEntity with robots policies and hreflang configuration for comprehensive SEO control per page.

## ADDED Requirements

### Requirement: Robots Meta Tag Configuration

The system SHALL support granular robots policy configuration per SEO metadata record, stored in `robotsPolicy` field as a JSONB object.

The robots policy MUST support:
- `index`: boolean (default: true) — controls `index/noindex`
- `follow`: boolean (default: true) — controls `follow/nofollow`
- `maxImagePreview`: 'none' | 'small' | 'large' | 'index' (optional)
- `maxVideoPreview`: 'none' | 'small' | 'large' | number (optional)
- `maxSnippet`: 'none' | number (optional)
- `noArchive`: boolean (optional)
- `noTranslate`: boolean (optional)

#### Scenario: Configure noindex for a page

- GIVEN an SEO metadata record for page `about-us`
- WHEN robotsPolicy is set to `{ index: false, follow: true }`
- THEN the rendered page includes `<meta name="robots" content="noindex, follow">`

#### Scenario: Full robots policy

- GIVEN an SEO metadata record with full policy `{ index: true, follow: true, noArchive: true, maxImagePreview: 'large' }`
- WHEN the page renders
- THEN the robots meta tag contains `max-image-preview:large` and `noarchive`

### Requirement: Robots Policy Override at Route Level

The system SHOULD support global robots policy defaults in nuxt.config.ts that can be overridden per-page via SeoMetadataEntity.

Default route rules in nuxt.config.ts SHOULD set `index: true, follow: true` for all CMS routes unless explicitly overridden.

### Requirement: hreflang Fields in SeoMetadataEntity

The system SHALL add hreflang-specific configuration to SeoMetadataEntity:

- `hreflangEnabled`: boolean (default: true)
- `hreflangAlternateLocales`: string[] (nullable) — specific locales to include
- `hreflangCustomUrls`: Record<string, string> (nullable, jsonb) — explicit URLs per locale

#### Scenario: Disable hreflang for specific page

- GIVEN an SEO metadata record with `hreflangEnabled: false`
- WHEN the page renders
- THEN no hreflang link tags are generated for this page

#### Scenario: Custom hreflang URLs

- GIVEN an SEO metadata record with `hreflangCustomUrls: { 'en': 'https://other-domain.com/en/page', 'es': 'https://other-domain.com/es/page' }`
- WHEN hreflang tags are generated
- THEN they use the custom URLs instead of auto-generated locale URLs

## Data Model Changes

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `robotsPolicy` | jsonb | yes | null | Robots policy object |
| `hreflangEnabled` | boolean | no | true | Enable/disable hreflang |
| `hreflangAlternateLocales` | simple-array | yes | null | Specific locales to include |
| `hreflangCustomUrls` | jsonb | yes | null | Custom URL per locale |

## Unchanged Behavior

The following existing fields remain unchanged:
- `metaTitle`, `metaDescription`, `metaKeywords`
- `ogTitle`, `ogDescription`, `ogImage`
- `canonicalUrl`
- `customJsonLd` (custom JSON-LD, not categorized)
- `type` (WebPage | Article | WebSite)
- `lang`, `pageId`

## Out of Scope

- Automatic robots.txt generation (handled by @nuxtjs/robots module)
- robots.txt file editing UI
- Bulk robots policy updates across pages