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
import { CreateLangDto } from './dto/create-lang.dto';
import { UpdateLangDto } from './dto/update-lang.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';

@ApiTags('Translations')
@Controller({
  path: 'translations',
  version: '1',
})
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

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

  @Get()
  @ApiOperation({ summary: 'List translations with filters' })
  @ApiQuery({ name: 'section', required: false })
  @ApiQuery({ name: 'langId', required: false })
  @ApiQuery({ name: 'entityName', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  findAllTranslations(
    @Query('section') section?: string,
    @Query('langId') langId?: string,
    @Query('entityName') entityName?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.translationsService.findAllTranslations({
      section,
      langId: langId ? +langId : undefined,
      entityName,
      entityId,
    });
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
