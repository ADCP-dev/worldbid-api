import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';
import { BlogPostEntity } from '../blog/posts/infrastructure/entities/blog-post.entity';
import { PageEntity } from '../pages/infrastructure/entities/page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPostEntity, PageEntity])],
  controllers: [SitemapController],
  providers: [SitemapService],
  exports: [SitemapService],
})
export class SitemapModule {}
