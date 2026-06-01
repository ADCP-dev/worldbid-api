/** Translation content for a single locale. */
export interface BlogPostTranslation {
  title?: string
  excerpt?: string
  content?: string
}

/** Blog post as returned by the public CMS API. */
export interface BlogPost {
  id: string | number
  slug: string
  title?: string
  publishedAt?: string
  featuredImage?: {
    url?: string
    path?: string
  }
  category?: {
    id?: string
    slug?: string
    name?: string
  }
  categoryId?: string
  categoryName?: string
  tags?: Array<{
    id: string
    name: string
  }>
  translations?: Record<string, BlogPostTranslation>
}
