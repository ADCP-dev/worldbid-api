# Delta for cms-pages-ui

## ADDED Requirements

### Requirement: Single-screen layout

The system MUST display all page fields in a single screen without tabs.

#### Scenario: Page form renders without tabs

- GIVEN a user navigates to the page editor
- WHEN the form loads
- THEN all fields MUST be visible on a single screen
- AND there MUST NOT be "Contenido" or "Configuración" tabs

### Requirement: Name field with auto-slug

The system MUST provide a Name text input that auto-generates the Slug field in kebab-case.

#### Scenario: Typing in Name auto-fills Slug

- GIVEN the page form is loaded
- WHEN the user types "My Page Name" into the Name field
- THEN the Slug field MUST auto-populate with `my-page-name`

### Requirement: Section selector in UI

The system MUST provide a Section dropdown with options: landing, blog, documentación, tienda.

#### Scenario: Section is selected

- GIVEN the page form is loaded
- WHEN the user opens the Section dropdown
- THEN the four options MUST be available for selection

### Requirement: SEO selector in UI

The system MUST provide an SEO dropdown with options: General, Home, Product, Article.

#### Scenario: SEO is selected

- GIVEN the page form is loaded
- WHEN the user opens the SEO dropdown
- THEN the SEO options MUST be available for selection

### Requirement: Translations table filtered by entityName

The system MUST display a translations table filtered by `entityName = Page`.

#### Scenario: Translations table shows page translations

- GIVEN the page form is loaded
- WHEN the translations section renders
- THEN it MUST display only translations where `entityName` equals `Page`

## MODIFIED Requirements

### Requirement: Page form fields

The page form MUST include: Language selector, Name, Slug, SEO, Section, and Translations table.

(Previously: The form had Content and Configuration tabs with title, content, excerpt, order, and template fields.)

#### Scenario: Existing page is edited

- GIVEN an existing page
- WHEN the user opens the edit form
- THEN the fields MUST match the new structure

## REMOVED Requirements

### Requirement: Content tab

(Reason: All fields are now on a single screen.)

### Requirement: Configuration tab

(Reason: All fields are now on a single screen.)

### Requirement: Excerpt field in UI

(Reason: Pages no longer have an excerpt.)

### Requirement: Order field in UI

(Reason: Page ordering is no longer managed.)

### Requirement: Template field in UI

(Reason: Replaced by the Section selector.)
