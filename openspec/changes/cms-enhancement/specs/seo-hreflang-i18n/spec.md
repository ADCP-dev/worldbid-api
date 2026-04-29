# seo-hreflang-i18n

## Purpose

hreflang tag generation integrated with i18n locale routes, enabling search engines to understand localized versions of CMS pages.

## Requirements

### Requirement: hreflang Link Tags Generation

The system SHALL generate `<link rel="alternate" hreflang="x">` tags for all configured locales when rendering a CMS page.

Each hreflang tag MUST reference the localized URL of the current page in each supported locale.

#### Scenario: Generate hreflang tags for blog post

- GIVEN a blog post at `/en/blog/my-post` with locales `en` and `es`
- WHEN the page renders
- THEN it outputs `<link rel="alternate" hreflang="en" href="https://domain.com/en/blog/my-post">` and `<link rel="alternate" hreflang="es" href="https://domain.com/es/blog/my-post">`

#### Scenario: x-default hreflang tag

- GIVEN a blog post accessible via multiple locales
- WHEN the page renders
- THEN it SHOULD also output a `x-default` hreflang tag pointing to the default locale URL

### Requirement: hreflang Configuration Storage

The system SHALL store hreflang configuration in SeoMetadataEntity, allowing per-page override of the default hreflang behavior.

The hreflang configuration MUST support:
- `enabled`: boolean to enable/disable hreflang generation for a specific page
- `alternateLocales`: array of locale codes to include (empty = all active locales)
- `customUrls`: map of locale code to explicit URL (overrides generated URL)

### Requirement: i18n Route Integration

The system MUST use i18n locale configuration to determine available locales for hreflang generation. The i18n module's locale list SHALL be the source of truth for active locales.

hreflang URLs MUST match the i18n route pattern (e.g., `/[lang]/blog/[slug]`).

### Requirement: Canonical URL Alignment

The system SHALL ensure hreflang tags do not conflict with canonical URLs. If a canonicalUrl is set in SeoMetadataEntity, the hreflang base URL MUST respect it.

## Data Model

```
SeoMetadataEntity:
  hreflangEnabled: boolean (default: true)
  hreflangAlternateLocales: string[] (nullable)
  hreflangCustomUrls: Record<string, string> (nullable, jsonb)
```

## Out of Scope

- Automatic sitemap.xml hreflang inclusion (handled by @nuxtjs/sitemap module)
- Language-region specific hreflang (e.g., `en-GB`) — use base locale code only
- Cross-domain hreflang (requires explicit URL configuration)