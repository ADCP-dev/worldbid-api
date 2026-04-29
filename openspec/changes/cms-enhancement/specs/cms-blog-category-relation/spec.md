# cms-blog-category-relation

## Purpose

Define BlogPost relationship to exactly one Category and N Tags via join table, replacing simple-array tags with proper relational structure.

## Requirements

### Requirement: BlogPost to Category (1:1)

The system SHALL associate each BlogPost with exactly one BlogCategory via a non-nullable foreign key `categoryId`.

A BlogPost MUST have a categoryId that references a valid BlogCategory.id, or NULL if not yet categorized.

#### Scenario: Create blog post with category

- GIVEN a BlogCategory with id `cat-123`
- WHEN a BlogPost is created with categoryId `cat-123`
- THEN the post's category relationship resolves to the BlogCategory entity
- AND the post appears in the category's posts via reverse relation

#### Scenario: Query posts by category

- GIVEN 5 blog posts in category `cat-123` and 3 in `cat-456`
- WHEN querying posts filtered by categoryId `cat-123`
- THEN exactly 5 posts are returned

### Requirement: BlogPost to Tags (N:N via Join Table)

The system SHALL implement a many-to-many relationship between BlogPost and tags via a `blog_post_tag` join table.

Tags are represented by a `PostTagEntity` with a unique `name` field, enabling tag reuse across posts.

#### Scenario: Associate multiple tags with post

- GIVEN tag `typescript` and tag `nestjs` exist
- WHEN a BlogPost is created with tagIds referencing both
- THEN the post.tags relation returns both Tag entities
- AND querying posts by tag returns posts with that tag

#### Scenario: Tag creation on demand

- GIVEN a blog post with tags `['new-tag', 'existing-tag']`
- WHEN saving the post
- THEN `new-tag` is created as a new PostTagEntity if it doesn't exist
- AND `existing-tag` resolves to the existing tag entity

### Requirement: PostTagEntity Schema

```
PostTagEntity:
  id: UUID (PK)
  name: string (unique, indexed)
  createdAt: timestamp
  updatedAt: timestamp

Join Table: blog_post_tag
  postId: UUID (FK -> blog_post.id)
  tagId: UUID (FK -> post_tag.id)
  PRIMARY KEY (postId, tagId)
```

### Requirement: Backward Compatibility for Tags Field

The existing `tags: simple-array` column on BlogPostEntity SHALL be deprecated but preserved for migration purposes.

New implementation uses the join table; the simple-array column remains for data integrity during transition.

## Data Model Changes

| Entity | Change | Details |
|--------|--------|---------|
| BlogPostEntity | Add column | `categoryId: uuid (nullable, FK -> blog_category.id)` |
| BlogPostEntity | Add relation | `category: ManyToOne -> BlogCategoryEntity` |
| BlogPostEntity | Add relation | `tags: ManyToMany -> PostTagEntity (via blog_post_tag)` |
| PostTagEntity | New entity | id, name (unique), timestamps |
| blog_post_tag | New table | postId, tagId (composite PK) |

## Out of Scope

- Many-to-many category relation (posts have ONE category only)
- Tag categories/groupings (flat tag list only)
- Tag popularity metrics or filtering