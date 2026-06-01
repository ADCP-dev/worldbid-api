import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'cms',
  version: '1.0.0',
  displayName: 'Content Management System',
  description:
    'Full-featured CMS with pages, blog posts, media management, SEO metadata, and sitemap generation.',
  author: 'Foundation Team',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  contributes: {
    routes: [
      // Pages
      { method: 'GET', path: 'cms/pages' },
      { method: 'POST', path: 'cms/pages' },
      { method: 'GET', path: 'cms/pages/public' },
      { method: 'GET', path: 'cms/pages/public/:slug' },
      { method: 'GET', path: 'cms/pages/:id' },
      { method: 'GET', path: 'cms/pages/:id/preview' },
      { method: 'PUT', path: 'cms/pages/reorder' },
      { method: 'PATCH', path: 'cms/pages/:id' },
      { method: 'PATCH', path: 'cms/pages/:id/reorder' },
      { method: 'PATCH', path: 'cms/pages/:id/publish' },
      { method: 'DELETE', path: 'cms/pages/:id' },

      // Blog Posts
      { method: 'GET', path: 'cms/blog/posts' },
      { method: 'POST', path: 'cms/blog/posts' },
      { method: 'GET', path: 'cms/blog/posts/public' },
      { method: 'GET', path: 'cms/blog/posts/public/category/:categoryId' },
      { method: 'GET', path: 'cms/blog/posts/public/:slug' },
      { method: 'GET', path: 'cms/blog/posts/:id' },
      { method: 'GET', path: 'cms/blog/posts/:id/preview' },
      { method: 'POST', path: 'cms/blog/posts/:id/featured-image' },
      { method: 'PATCH', path: 'cms/blog/posts/:id' },
      { method: 'PATCH', path: 'cms/blog/posts/:id/publish' },
      { method: 'DELETE', path: 'cms/blog/posts/:id' },

      // Blog Categories
      { method: 'GET', path: 'cms/blog/categories' },
      { method: 'POST', path: 'cms/blog/categories' },
      { method: 'GET', path: 'cms/blog/categories/:id' },
      { method: 'PATCH', path: 'cms/blog/categories/:id' },
      { method: 'PATCH', path: 'cms/blog/categories/:id/reorder' },
      { method: 'DELETE', path: 'cms/blog/categories/:id' },

      // Tags
      { method: 'GET', path: 'cms/blog/tags' },
      { method: 'POST', path: 'cms/blog/tags' },
      { method: 'GET', path: 'cms/blog/tags/public' },
      { method: 'GET', path: 'cms/blog/tags/:id' },
      { method: 'PATCH', path: 'cms/blog/tags/:id' },
      { method: 'DELETE', path: 'cms/blog/tags/:id' },

      // Media
      { method: 'GET', path: 'cms/media' },
      { method: 'POST', path: 'cms/media/upload' },

      // SEO
      { method: 'GET', path: 'cms/seo/:pageId' },
      { method: 'GET', path: 'cms/seo/:entityName/:entityId' },
      { method: 'PATCH', path: 'cms/seo/:pageId' },

      // Sitemap
      { method: 'GET', path: 'sitemap/blog' },
      { method: 'GET', path: 'sitemap/pages' },
    ],
    entities: [
      { name: 'Page', table: 'ext_cms_page' },
      { name: 'BlogPost', table: 'ext_cms_blog_post' },
      { name: 'BlogCategory', table: 'ext_cms_blog_category' },
      { name: 'Tag', table: 'ext_cms_post_tag' },
      { name: 'SeoMetadata', table: 'ext_cms_seo_metadata' },
    ],
    seeds: true,
    config: ['cms'],
    menuItems: [
      {
        heading: 'Content',
        items: [
          { title: 'Pages', icon: 'file-text', link: '/admin/cms/pages' },
          { title: 'Blog Posts', icon: 'edit', link: '/admin/cms/blog/posts' },
          {
            title: 'Categories',
            icon: 'folder',
            link: '/admin/cms/blog/categories',
          },
          { title: 'Tags', icon: 'tag', link: '/admin/cms/tags' },
          { title: 'Media', icon: 'image', link: '/admin/cms/media' },
        ],
      },
      {
        heading: 'Settings',
        items: [
          { title: 'SEO', icon: 'search', link: '/admin/cms/seo' },
          { title: 'Sitemap', icon: 'map', link: '/admin/cms/sitemap' },
        ],
      },
    ],
    permissions: [
      { action: 'cms:pages:create', description: 'Create pages' },
      { action: 'cms:pages:read', description: 'Read pages' },
      { action: 'cms:pages:update', description: 'Update pages' },
      { action: 'cms:pages:delete', description: 'Delete pages' },
      { action: 'cms:pages:publish', description: 'Publish/unpublish pages' },
      { action: 'cms:posts:create', description: 'Create blog posts' },
      { action: 'cms:posts:read', description: 'Read blog posts' },
      { action: 'cms:posts:update', description: 'Update blog posts' },
      { action: 'cms:posts:delete', description: 'Delete blog posts' },
      {
        action: 'cms:posts:publish',
        description: 'Publish/unpublish blog posts',
      },
      {
        action: 'cms:categories:manage',
        description: 'Manage blog categories',
      },
      { action: 'cms:tags:manage', description: 'Manage tags' },
      { action: 'cms:media:upload', description: 'Upload media files' },
      { action: 'cms:media:delete', description: 'Delete media files' },
      { action: 'cms:seo:manage', description: 'Manage SEO metadata' },
    ],
  },
};

export default manifest;
export { manifest };
