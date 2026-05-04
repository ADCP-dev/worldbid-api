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
import { LangEntity } from '@src/modules/translations/infrastructure/entities/lang.entity';

@Injectable()
export class SitemapService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly blogPostRepository: Repository<BlogPostEntity>,
    @InjectRepository(PageEntity)
    private readonly pageRepository: Repository<PageEntity>,
    @InjectRepository(LangEntity)
    private readonly langRepository: Repository<LangEntity>,
  ) {}

  private async getActiveLanguages(): Promise<string[]> {
    const langs = await this.langRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    return langs.map((l) => l.code);
  }

  async getBlogUrls(): Promise<SitemapUrl[]> {
    const posts = await this.blogPostRepository.find({
      where: { isPublished: true },
      order: { updatedAt: 'DESC' },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const langs = await this.getActiveLanguages();

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
    const langs = await this.getActiveLanguages();

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
