import { Controller, Get } from '@nestjs/common';
import { SitemapService } from './sitemap.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Sitemap')
@Controller({
  path: 'sitemap',
  version: '1',
})
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Get('blog')
  async getBlogUrls() {
    return this.sitemapService.getBlogUrls();
  }

  @Get('pages')
  async getPageUrls() {
    return this.sitemapService.getPageUrls();
  }
}
