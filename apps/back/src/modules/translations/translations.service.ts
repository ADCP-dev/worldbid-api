import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { LangEntity } from './infrastructure/entities/lang.entity';
import { TranslationEntity } from './infrastructure/entities/translation.entity';
import { CreateLangDto } from './dto/create-lang.dto';
import { UpdateLangDto } from './dto/update-lang.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { InfinityPaginationResponseDto } from '@infra/utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '@infra/utils/infinity-pagination';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TranslationsService {
  constructor(
    @InjectRepository(LangEntity)
    private readonly langRepository: Repository<LangEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
  ) {}

  // Lang CRUD
  async createLang(createLangDto: CreateLangDto): Promise<LangEntity> {
    const lang = this.langRepository.create(createLangDto);
    return this.langRepository.save(lang);
  }

  async findAllLangs(): Promise<LangEntity[]> {
    return this.langRepository.find({
      order: {
        id: 'ASC',
      },
    });
  }

  async findOneLang(id: number): Promise<LangEntity> {
    const lang = await this.langRepository.findOne({ where: { id } });
    if (!lang) {
      throw new NotFoundException(`Lang with ID ${id} not found`);
    }
    return lang;
  }

  async updateLang(
    id: number,
    updateLangDto: UpdateLangDto,
  ): Promise<LangEntity> {
    const lang = await this.findOneLang(id);
    this.langRepository.merge(lang, updateLangDto);
    return this.langRepository.save(lang);
  }

  async deleteLang(id: number): Promise<void> {
    const lang = await this.findOneLang(id);
    await this.langRepository.remove(lang);
  }

  // Translation CRUD
  async createTranslation(
    createTranslationDto: CreateTranslationDto,
  ): Promise<TranslationEntity> {
    const { langId, ...rest } = createTranslationDto;
    const lang = await this.findOneLang(langId);

    const translation = this.translationRepository.create({
      ...rest,
      lang,
    });
    return this.translationRepository.save(translation);
  }

  async findAllTranslationsWithPagination(
    filters: {
      section?: string;
      langId?: number;
      entityName?: string;
      entityId?: string;
      app?: string;
      q?: string;
    },
    paginationOptions: {
      page: number;
      limit: number;
    },
    baseUrl: string,
  ): Promise<InfinityPaginationResponseDto<any>> {
    const { page, limit } = paginationOptions;
    const skip = (page - 1) * limit;

    // 1. First, we need a query to get the DISTINCT groups (app, section, key).
    // The trick is that TypeORM doesn't natively handle distinct-on-multiple-columns cleanly combined with getManyAndCount
    // alongside complex joining.
    // Instead, we will group by those fields and select them to paginate the "groups".
    const groupQueryBuilder = this.translationRepository
      .createQueryBuilder('translation')
      .select(['translation.app', 'translation.section', 'translation.key'])
      .leftJoin('translation.lang', 'lang')
      .groupBy('translation.app')
      .addGroupBy('translation.section')
      .addGroupBy('translation.key');

    // Apply Filters to the group query
    if (filters.section) {
      groupQueryBuilder.andWhere('translation.section = :section', {
        section: filters.section,
      });
    }
    if (filters.langId) {
      groupQueryBuilder.andWhere('lang.id = :langId', {
        langId: filters.langId,
      });
    }
    if (filters.entityName) {
      groupQueryBuilder.andWhere('translation.entityName = :entityName', {
        entityName: filters.entityName,
      });
    } else {
      groupQueryBuilder.andWhere('translation.entityName IS NULL');
    }
    if (filters.entityId) {
      groupQueryBuilder.andWhere('translation.entityId = :entityId', {
        entityId: filters.entityId,
      });
    } else {
      groupQueryBuilder.andWhere('translation.entityId IS NULL');
    }
    if (filters.app) {
      groupQueryBuilder.andWhere('translation.app = :app', {
        app: filters.app,
      });
    }

    if (filters.q) {
      groupQueryBuilder.andWhere(
        '(translation.key ILIKE :q OR translation.content ILIKE :q OR translation.section ILIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    // Since it's grouped, we count the raw results for total pages
    const countQuery = groupQueryBuilder.clone();
    const [queryString, params] = countQuery.getQueryAndParameters();
    // Wrap it in a subquery to count distinct groups
    const [{ count: totalCountStr }] = await this.translationRepository.query(
      `
        SELECT COUNT(*) as count FROM (${queryString}) as grouped
    `,
      params,
    );
    const totalCount = parseInt(totalCountStr, 10);

    // Apply pagination on the group query
    groupQueryBuilder.offset(skip).limit(limit);

    // Get the distinct groups for this page
    const paginatedGroups = await groupQueryBuilder.getRawMany();

    if (paginatedGroups.length === 0) {
      return infinityPagination(
        [],
        { page, limit },
        totalCount,
        filters,
        baseUrl,
      );
    }

    // 2. Now fetch ALL translations for these specific groups
    const detailQueryBuilder = this.translationRepository
      .createQueryBuilder('translation')
      .leftJoinAndSelect('translation.lang', 'lang')
      .where('1=0'); // Start with a false condition

    // We build an OR condition for each group. E.g. (app=X AND section=Y AND key=Z) OR ...
    paginatedGroups.forEach((group, index) => {
      const appKey = `app_${index}`;
      const secKey = `sec_${index}`;
      const kKey = `k_${index}`;

      const appCondition =
        group.translation_app != null
          ? `translation.app = :${appKey}`
          : `translation.app IS NULL`;
      const secCondition =
        group.translation_section != null
          ? `translation.section = :${secKey}`
          : `translation.section IS NULL`;
      const keyCondition =
        group.translation_key != null
          ? `translation.key = :${kKey}`
          : `translation.key IS NULL`;

      const conditions = [appCondition, secCondition, keyCondition].join(
        ' AND ',
      );

      detailQueryBuilder.orWhere(`(${conditions})`, {
        [appKey]: group.translation_app,
        [secKey]: group.translation_section,
        [kKey]: group.translation_key,
      });
    });

    const allTranslationsForGroups = await detailQueryBuilder.getMany();

    // 3. Assemble the grouped format for the frontend
    const assembledItems = paginatedGroups.map((group, index) => {
      const groupApp = group.translation_app;
      const groupSection = group.translation_section;
      const groupKey = group.translation_key;

      const groupTranslations = allTranslationsForGroups.filter(
        (t) =>
          (t.app || null) === (groupApp || null) &&
          (t.section || null) === (groupSection || null) &&
          (t.key || null) === (groupKey || null),
      );

      // Create a unified group object. Use the first translation's ID as a stable row ID, or generate one.
      return {
        id:
          groupTranslations.length > 0
            ? groupTranslations[0].id
            : `group_${index}`,
        app: groupApp,
        section: groupSection,
        key: groupKey,
        translations: groupTranslations,
      };
    });

    return infinityPagination(
      assembledItems,
      { page, limit },
      totalCount,
      filters,
      baseUrl,
    );
  }

  async getExactTranslationGroup(
    app: string,
    section: string,
    key: string,
  ): Promise<any> {
    const translations = await this.translationRepository.find({
      where: {
        app,
        section,
        key,
        entityName: IsNull(),
        entityId: IsNull(),
      },
      relations: ['lang'],
    });

    return {
      app,
      section,
      key,
      translations,
    };
  }

  async findOneTranslation(id: number): Promise<TranslationEntity> {
    const translation = await this.translationRepository.findOne({
      where: { id },
      relations: ['lang'],
    });
    if (!translation) {
      throw new NotFoundException(`Translation with ID ${id} not found`);
    }
    return translation;
  }

  async updateTranslation(
    id: number,
    updateTranslationDto: UpdateTranslationDto,
  ): Promise<TranslationEntity> {
    const translation = await this.findOneTranslation(id);
    const { langId, ...rest } = updateTranslationDto;

    if (langId) {
      const lang = await this.findOneLang(langId);
      translation.lang = lang;
    }

    this.translationRepository.merge(translation, rest);
    return this.translationRepository.save(translation);
  }

  async deleteTranslation(id: number): Promise<void> {
    const translation = await this.findOneTranslation(id);
    await this.translationRepository.remove(translation);
  }

  // Generation
  async generateJsonFiles(): Promise<{ message: string }> {
    const langs = await this.langRepository.find({ where: { isActive: true } });
    const cwd = process.cwd();
    // Support execution from root or apps/back
    const isBackContext =
      cwd.endsWith('apps/back') || cwd.endsWith(`apps\\back`);
    const backRootPath = path.join(
      isBackContext ? cwd : path.join(cwd, 'apps/back'),
      'src/i18n',
    );
    const frontRootPath = path.join(
      isBackContext ? path.join(cwd, '../front') : path.join(cwd, 'apps/front'),
      'locales',
    );

    for (const lang of langs) {
      const translations = await this.translationRepository.find({
        where: {
          lang: { id: lang.id },
          entityName: IsNull(),
          entityId: IsNull(),
        },
      });

      // Group by App -> TopLevelSection -> RestOfKey
      const groupedData: Record<string, Record<string, any>> = {
        front: {},
        back: {},
      };

      for (const t of translations) {
        const fullPath = t.section ? `${t.section}.${t.key}` : t.key;
        const firstDotIndex = fullPath.indexOf('.');
        let topLevelSection = fullPath;
        let restOfPath = '';

        if (firstDotIndex !== -1) {
          topLevelSection = fullPath.substring(0, firstDotIndex);
          restOfPath = fullPath.substring(firstDotIndex + 1);
        }

        // Determine destination apps
        const targetApps: ('front' | 'back' | 'common')[] = [];
        if (t.app === 'back') targetApps.push('back');
        else if (t.app === 'front') targetApps.push('front');
        else targetApps.push('front', 'back'); // 'common' or null defaults to both

        for (const targetApp of targetApps) {
          if (!groupedData[targetApp][topLevelSection]) {
            groupedData[targetApp][topLevelSection] = {};
          }
          if (restOfPath) {
            this.setDeepValue(
              groupedData[targetApp][topLevelSection],
              restOfPath,
              t.content,
            );
          } else {
            groupedData[targetApp][topLevelSection] = t.content;
          }
        }
      }

      // Write files
      for (const [app, sections] of Object.entries(groupedData)) {
        const rootPath = app === 'front' ? frontRootPath : backRootPath;
        const langPath = path.join(rootPath, lang.code);

        await fs.mkdir(langPath, { recursive: true });

        for (const [sectionName, data] of Object.entries(sections)) {
          const jsonContent = JSON.stringify(data, null, 2);
          const fileName = `${sectionName}.json`;
          await fs.writeFile(path.join(langPath, fileName), jsonContent);
        }
      }
    }

    return { message: 'JSON files generated successfully' };
  }

  private setDeepValue(obj: any, path: string, value: any) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (i === keys.length - 1) {
        current[key] = value;
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }
  }

  // Dynamic Translations
  async getTranslationsForEntity(
    entityName: string,
    entityId: string,
    langCode: string,
  ): Promise<Record<string, string>> {
    const lang = await this.langRepository.findOne({
      where: { code: langCode },
    });
    if (!lang) return {};

    const translations = await this.translationRepository.find({
      where: {
        entityName,
        entityId,
        lang: { id: lang.id },
      },
    });

    const result = {};
    for (const t of translations) {
      result[t.key] = t.content;
    }
    return result;
  }
}
