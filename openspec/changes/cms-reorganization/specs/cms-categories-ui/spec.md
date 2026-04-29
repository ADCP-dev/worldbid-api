# Delta for cms-categories-ui

## ADDED Requirements

### Requirement: Description field in UI

The system MUST provide a language-dependent Description textarea in the category form.

#### Scenario: Category description is entered

- GIVEN the category form is loaded
- WHEN the user types into the Description field
- THEN the value MUST be bound to the form model for the current language

## MODIFIED Requirements

### Requirement: Category form fields

The category form MUST include: Language selector, Name, Slug, Description, and Translations table. Name, Slug, and Description MUST all be language-dependent.

(Previously: The form had Name and Slug only, and fields were not language-dependent.)

#### Scenario: Category is edited with description

- GIVEN an existing category
- WHEN the user opens the edit form
- THEN the Description field MUST be present and editable

## REMOVED Requirements

None.
