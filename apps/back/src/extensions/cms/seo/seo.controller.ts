import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('CMS SEO')
@Controller({
  path: 'cms/seo',
  version: '1',
})
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get(':pageId')
  @ApiParam({ name: 'pageId', type: String })
  findOne(@Param('pageId') pageId: string, @Query('lang') lang: string = 'es') {
    return this.seoService.findByPageId(pageId, lang);
  }

  @Patch(':pageId')
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
