# Delta for CMS Blog Posts

## ADDED Requirements

### Requirement: Blog Post Content Preview Endpoint

The system MUST expose `GET /cms/blog/posts/:id/preview` that returns the rendered preview of a blog post, including its current title, content, and featured image, without requiring publication.

#### Scenario: Previewing a draft post

- GIVEN a blog post with `isPublished: false`, `title: "Draft Post"`, and `content: "<p>Hello</p>"`
- WHEN `GET /cms/blog/posts/{id}/preview` is called
- THEN the response MUST contain the post title, slug, content, and featured image URL
- AND the response MUST NOT return 404 solely because the post is unpublished

#### Scenario: Previewing a non-existent post

- GIVEN a request for a post ID that does not exist
- WHEN the preview endpoint is called
- THEN the system MUST return 404 Not Found

### Requirement: Featured Image CDN Upload

The system MUST support uploading a blog post featured image directly to a configured CDN (Backblaze, BunnyCDN, or Cloudflare) and persist the resulting CDN URL.

#### Scenario: Uploading a featured image to CDN

- GIVEN a blog post create or update request with a featured image file
- WHEN the image is processed
- THEN the system MUST upload the file to the active CDN driver
- AND the post MUST store the returned CDN URL instead of a local file reference

## MODIFIED Requirements

### Requirement: Blog Post Tags Relation

The system MUST replace the legacy `tags` simple-array column with a formal many-to-many relation to the canonical TagEntity. The `postTags` relation MUST be renamed to `tags` in API responses and DTOs.
(Previously: BlogPostEntity stored tags as `tags: string[]` and maintained a separate `postTags: PostTagEntity[]` relation.)

#### Scenario: Associating tags to a post

- GIVEN a blog post and two existing tags with IDs `tag-1` and `tag-2`
- WHEN the post is updated with `tags: ["tag-1", "tag-2"]`
- THEN the system MUST link the post to both tags via the join table
- AND subsequent reads MUST return the full tag objects in the `tags` array

#### Scenario: Removing all tags from a post

- GIVEN a blog post linked to one or more tags
- WHEN the post is updated with `tags: []`
- THEN the system MUST remove all join-table entries for that post

## REMOVED Requirements

### Requirement: Blog Post Excerpt Field

(Reason: The CMS redesign removes the excerpt field; previews are rendered from full content.)

#### Scenario: Creating a post without excerpt

- GIVEN a blog post create request without an `excerpt` field
- WHEN the request is processed
- THEN the system MUST persist the post without an `excerpt` value
