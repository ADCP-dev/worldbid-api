import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiTags('CMS SEO')
@Controller('v1/cms/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('template/:type')
  getTemplate(@Param('type') type: string) {
    const schema = this.seoService.getBaseSchema(type);
    if (!schema) {
      throw new NotFoundException(
        `Unknown JSON-LD type: ${type}. Valid types: Article, BlogPosting, BreadcrumbList, Organization, Product, WebPage, WebSite`,
      );
    }
    return schema;
  }

  @Get(':pageId')
  @ApiParam({ name: 'pageId', type: String })
  findOne(@Param('pageId') pageId: string, @Query('lang') lang: string = 'es') {
    return this.seoService.findByPageId(pageId, lang);
  }

  @Get(':entityName/:entityId')
  findByEntity(
    @Param('entityName') entityName: string,
    @Param('entityId') entityId: string,
    @Query('lang') lang: string = 'es',
  ) {
    return this.seoService.findByEntity(entityName, entityId, lang);
  }

  @Patch(':pageId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'pageId', type: String })
  update(
    @Param('pageId') pageId: string,
    @Query('lang') lang: string = 'es',
    @Body() updateSeoDto: UpdateSeoDto,
  ) {
    return this.seoService.upsert(pageId, lang, updateSeoDto);
  }
}
