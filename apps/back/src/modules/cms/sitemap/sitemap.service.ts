export interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
  alternates?: {
    languages: Record<string, string>;
  };
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostEntity } from '../blog/posts/infrastructure/entities/blog-post.entity';
import { PageEntity } from '../pages/infrastructure/entities/page.entity';

@Injectable()
export class SitemapService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly blogPostRepository: Repository<BlogPostEntity>,
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
  ) {}

  async getBlogUrls(): Promise<SitemapUrl[]> {
    const posts = await this.blogPostRepository.find({
      where: { isPublished: true },
      order: { updatedAt: 'DESC' },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const langs = ['es', 'en'];

    const urls: SitemapUrl[] = [];
    for (const post of posts) {
      const alternates: Record<string, string> = {};
      for (const lang of langs) {
        alternates[lang] = `${frontendUrl}/${lang}/blog/${post.slug}`;
      }

      urls.push({
        loc: `${frontendUrl}/es/blog/${post.slug}`,
        lastmod: post.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
        alternates: { languages: alternates },
      });
    }

    return urls;
  }

  async getPageUrls(): Promise<SitemapUrl[]> {
    const pages = await this.pageRepository.find({
      where: { isPublished: true },
      order: { order: 'ASC' },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const langs = ['es', 'en'];

    const urls: SitemapUrl[] = [];
    for (const page of pages) {
      for (const lang of langs) {
        const route =
          page.route?.replace('/es/', `/${lang}/`) ||
          `/${lang}/page/${page.slug}`;
        urls.push({
          loc: `${frontendUrl}${route}`,
          lastmod: page.updatedAt.toISOString(),
          changefreq: 'monthly',
          priority: 0.6,
        });
      }
    }

    return urls;
  }
}
