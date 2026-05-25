import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { TranslationsService } from './translations.service';
import { TranslationAgentService } from './translation-agent.service';
import { CreateLangDto } from './dto/create-lang.dto';
import { UpdateLangDto } from './dto/update-lang.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { BatchTranslationDto } from './dto/batch-translation.dto';

import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';

@ApiTags('Translations')
@Controller({
  path: 'translations',
  version: '1',
})
export class TranslationsController {
  constructor(
    private readonly translationsService: TranslationsService,
    private readonly translationAgentService: TranslationAgentService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  // --- Langs ---

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('langs')
  @ApiOperation({ summary: 'Create a new language' })
  createLang(@Body() createLangDto: CreateLangDto) {
    return this.translationsService.createLang(createLangDto);
  }

  @Get('langs')
  @ApiOperation({ summary: 'List all languages' })
  findAllLangs() {
    return this.translationsService.findAllLangs();
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('langs/:id')
  updateLang(@Param('id') id: string, @Body() updateLangDto: UpdateLangDto) {
    return this.translationsService.updateLang(+id, updateLangDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('langs/:id')
  deleteLang(@Param('id') id: string) {
    return this.translationsService.deleteLang(+id);
  }

  // --- Translations ---

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Create a translation' })
  createTranslation(@Body() createTranslationDto: CreateTranslationDto) {
    return this.translationsService.createTranslation(createTranslationDto);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('dynamic/batch')
  @ApiOperation({ summary: 'Batch upsert dynamic translations' })
  async batchUpsertDynamic(@Body() batchDto: BatchTranslationDto) {
    const { entityName, entityId, category, lang, translations } = batchDto;

    const items = translations.map((t) => ({
      langCode: lang,
      key: t.key,
      content: t.value,
      section: t.section,
      category,
      entityName,
      entityId,
    }));

    return this.translationsService.batchUpsertDynamic(items, {
      entityName,
      entityId,
      category,
      lang,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List translations with filters and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'app', required: false })
  @ApiQuery({ name: 'filter', required: false, type: 'object' })
  findAllTranslations(
    @Req() request: Request,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('app') app?: string,
    @Query('filter') filter?: Record<string, string>,
  ) {
    const backendDomain = this.configService.getOrThrow('app.backendDomain', {
      infer: true,
    });
    const baseUrl = `${backendDomain}${request.url.split('?')[0]}`; // Only base path without query

    const langIdRaw = filter?.langId || filter?.lang;

    return this.translationsService.findAllTranslationsWithPagination(
      {
        section: filter?.section,
        key: filter?.key,
        langId: langIdRaw ? +langIdRaw : undefined,
        entityName: filter?.entityName,
        entityId: filter?.entityId,
        app,
        q: search,
        category: filter?.category,
      },
      {
        page,
        limit,
      },
      baseUrl,
    );
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  updateTranslation(
    @Param('id') id: string,
    @Body() updateTranslationDto: UpdateTranslationDto,
  ) {
    return this.translationsService.updateTranslation(
      +id,
      updateTranslationDto,
    );
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  deleteTranslation(@Param('id') id: string) {
    return this.translationsService.deleteTranslation(+id);
  }

  // --- Generation ---

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('generate')
  @ApiOperation({ summary: 'Generate static JSON files' })
  generateJsonFiles() {
    return this.translationsService.generateJsonFiles();
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Sync translations: generate JSON files from DB' })
  async syncTranslations(): Promise<{ message: string; files: string[] }> {
    const result = await this.translationsService.generateJsonFiles();
    return result;
  }

  // --- AI Translation ---

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('translate-row')
  @ApiOperation({
    summary:
      'Auto-translate missing languages for a specific app, section, and key',
  })
  async translateRow(
    @Body() body: { app: string; section: string; key: string },
  ) {
    const { app, section, key } = body;
    const result = await this.translationAgentService.translateRow(
      app,
      section,
      key,
    );
    return { success: true, message: result };
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('bulk-translate')
  @ApiOperation({
    summary: 'Bulk auto-translate ALL missing languages for an app context',
  })
  async bulkTranslate(@Body() body: { app?: string }) {
    const { app = 'front' } = body;
    const result = await this.translationAgentService.bulkTranslateAll(app);
    return { success: true, message: result };
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('translate-entity')
  @ApiOperation({
    summary: 'AI translate a dynamic CMS entity field to a target language',
  })
  async translateEntity(
    @Body()
    body: {
      entityName: string;
      entityId: string;
      field: string;
      sourceLang: string;
      targetLang: string;
    },
  ) {
    const { entityName, entityId, field, sourceLang, targetLang } = body;
    const result = await this.translationAgentService.translateEntity(
      entityName,
      entityId,
      field,
      targetLang,
      sourceLang,
    );
    return { success: true, message: result };
  }

  // --- Exact Match Fetch ---

  @Get('exact')
  @ApiOperation({ summary: 'Get exact translations by app, section, and key' })
  @ApiQuery({ name: 'app', required: true })
  @ApiQuery({ name: 'section', required: true })
  @ApiQuery({ name: 'key', required: true })
  getExactTranslationGroup(
    @Query('app') app: string,
    @Query('section') section: string,
    @Query('key') key: string,
  ) {
    return this.translationsService.getExactTranslationGroup(app, section, key);
  }

  @Get('exact-by-path')
  @ApiOperation({
    summary:
      'Get exact translations by app and dot path (e.g. base.auth.signIn.emailLabel)',
  })
  @ApiQuery({ name: 'app', required: true })
  @ApiQuery({ name: 'dotPath', required: true })
  getExactTranslationGroupByDotPath(
    @Query('app') app: string,
    @Query('dotPath') dotPath: string,
  ) {
    return this.translationsService.getExactTranslationGroupByDotPath(
      app,
      dotPath,
    );
  }

  // --- Dynamic Fetch ---

  @Get('dynamic/:lang/:entityName/:entityId')
  @ApiOperation({ summary: 'Get dynamic translations for an entity' })
  getDynamic(
    @Param('lang') lang: string,
    @Param('entityName') entityName: string,
    @Param('entityId') entityId: string,
  ) {
    return this.translationsService.getTranslationsForEntity(
      entityName,
      entityId,
      lang,
    );
  }
}
