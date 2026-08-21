import { Module } from '@nestjs/common';
import { PagesModule } from './pages/pages.module';
import { BlogModule } from './blog/blog.module';
import { SeoModule } from './seo/seo.module';
import { MediaModule } from './media/media.module';

// SitemapModule removed (R-CMS-R-01): sitemap is now centralized in Astro via
// @astrojs/sitemap. Backend /api/v1/sitemap/* endpoints deleted.
@Module({
  imports: [PagesModule, BlogModule, SeoModule, MediaModule],
  exports: [PagesModule, BlogModule, SeoModule, MediaModule],
})
export class CmsModule {}
