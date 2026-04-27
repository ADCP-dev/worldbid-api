# Delta for cms-blog-ui

## ADDED Requirements

### Requirement: FormMultipleSelect for tags

The system MUST provide a `FormMultipleSelect` component for selecting multiple tags on a blog post.

#### Scenario: Multiple tags are selected

- GIVEN the blog post form is loaded
- WHEN the user selects tags from the FormMultipleSelect
- THEN the selected tags MUST be bound to the form model

### Requirement: Fullscreen preview modal

The system MUST provide a fullscreen preview modal for blog post content. The modal MUST support real-time content editing and rendered preview.

#### Scenario: Preview modal is opened

- GIVEN the blog post form is loaded with content
- WHEN the user clicks the Previsualizar button
- THEN a fullscreen modal MUST open showing the rendered content

#### Scenario: Content is edited in preview modal

- GIVEN the preview modal is open
- WHEN the user edits the content in real-time
- THEN the preview MUST update to reflect the changes

### Requirement: Featured image CDN upload in UI

The system MUST provide an image upload component that uploads to the configured CDN.

#### Scenario: Image is uploaded from blog form

- GIVEN the blog post form is loaded
- WHEN the user selects and uploads a featured image
- THEN the image MUST be uploaded to the CDN
- AND the returned URL MUST be displayed/stored

### Requirement: Category selector in UI

The system MUST provide a single-select dropdown for choosing a blog post category.

#### Scenario: Category is selected for blog post

- GIVEN the blog post form is loaded
- WHEN the user selects a category from the dropdown
- THEN the selected category MUST be bound to the form model

## MODIFIED Requirements

### Requirement: Blog post form fields

The blog post form MUST include: Language selector, Title, Slug, Tags, Content, Preview button, Category, Featured Image, and Translations table.

(Previously: The form had title, slug, content, excerpt, and category fields without tags, preview, or featured image.)

#### Scenario: Blog post is created with new fields

- GIVEN a user creates a new blog post
- WHEN the form is rendered
- THEN all new fields MUST be present

## REMOVED Requirements

### Requirement: Excerpt field in blog UI

(Reason: Blog posts no longer have an excerpt.)
