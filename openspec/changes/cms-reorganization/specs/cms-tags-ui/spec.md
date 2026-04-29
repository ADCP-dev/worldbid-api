# cms-tags-ui Specification

## Purpose

Define the UI behavior for the new Tags management page.

## Requirements

### Requirement: Tags list page

The system MUST provide a page that lists all tags with columns for name and text ID.

#### Scenario: Tags list is displayed

- GIVEN tags exist in the system
- WHEN a user navigates to the Tags page
- THEN a table MUST display all tags with their name and text ID

### Requirement: Tag creation form

The system MUST provide a form to create a new tag with Name and Text ID fields.

#### Scenario: New tag is created

- GIVEN a user is on the Tags page
- WHEN the user fills in Name and Text ID and submits
- THEN the new tag MUST be created and appear in the list

### Requirement: Tag edit form

The system MUST provide a form to edit an existing tag with Name and Text ID fields.

#### Scenario: Existing tag is edited

- GIVEN an existing tag
- WHEN the user edits the Name or Text ID and submits
- THEN the tag MUST be updated in the system

### Requirement: Language selector on tags

The system MUST provide a language selector on the tag form. Name and Text ID MUST vary per selected language.

#### Scenario: Language is switched on tag form

- GIVEN a tag form is open
- WHEN the user switches the language selector
- THEN the Name and Text ID fields MUST reflect the values for the selected language

### Requirement: Translations table on tags

The system MUST display a translations table on the tag form filtered by `entityName = Tag`.

#### Scenario: Tag translations are displayed

- GIVEN a tag is being viewed or edited
- WHEN the translations section renders
- THEN it MUST display only translations where `entityName` equals `Tag`
