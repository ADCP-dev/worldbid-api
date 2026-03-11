import { Module } from '@nestjs/common';
import { PagesModule } from './pages/pages.module';
import { BlogModule } from './blog/blog.module';
import { SeoModule } from './seo/seo.module';
import { MediaModule } from './media/media.module';
import { SitemapModule } from './sitemap/sitemap.module';

@Module({
  imports: [PagesModule, BlogModule, SeoModule, MediaModule, SitemapModule],
  exports: [PagesModule, BlogModule, SeoModule, MediaModule, SitemapModule],
})
export class CmsModule {}
