# tanstack-query-integration Specification

## Purpose

Define the adoption of TanStack Query (Vue Query) for data fetching across CMS modules.

## Requirements

### Requirement: TanStack Query setup

The system MUST install and configure `@tanstack/vue-query` at the application root. Query clients MUST be configured with appropriate stale times and cache invalidation strategies.

#### Scenario: Vue Query provider is initialized

- GIVEN the application starts
- WHEN the root component mounts
- THEN the Vue Query provider MUST be active with a configured QueryClient

### Requirement: Query keys for CMS entities

The system MUST define consistent query keys for pages, blog posts, categories, and tags.

#### Scenario: Query keys are used for caching

- GIVEN a CMS entity list is fetched
- WHEN TanStack Query caches the response
- THEN subsequent requests MUST use the cached data until invalidated

### Requirement: Replace direct fetch with useQuery/useMutation

All CMS data fetching MUST use `useQuery` for reads and `useMutation` for writes. Direct `fetch` calls in CMS composables MUST be removed.

#### Scenario: Pages are fetched via useQuery

- GIVEN the pages list component mounts
- WHEN data is requested
- THEN `useQuery` MUST be used to fetch pages
- AND loading and error states MUST be handled by TanStack Query

#### Scenario: Page is created via useMutation

- GIVEN a user submits a new page form
- WHEN the create action is triggered
- THEN `useMutation` MUST be used
- AND on success, the pages cache MUST be invalidated

### Requirement: Cache invalidation on mutations

The system MUST invalidate relevant query caches after create, update, and delete mutations.

#### Scenario: Cache is invalidated after blog post update

- GIVEN a blog post is updated via mutation
- WHEN the mutation succeeds
- THEN the blog posts query cache MUST be invalidated
- AND the UI MUST reflect the updated data
