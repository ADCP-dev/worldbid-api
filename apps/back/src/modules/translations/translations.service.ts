import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { LangEntity } from './infrastructure/entities/lang.entity';
import { TranslationEntity } from './infrastructure/entities/translation.entity';
import { CreateLangDto } from './dto/create-lang.dto';
import { UpdateLangDto } from './dto/update-lang.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
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
    return this.langRepository.find();
  }

  async findOneLang(id: number): Promise<LangEntity> {
    const lang = await this.langRepository.findOne({ where: { id } });
    if (!lang) {
      throw new NotFoundException(`Lang with ID ${id} not found`);
    }
    return lang;
  }

  async updateLang(id: number, updateLangDto: UpdateLangDto): Promise<LangEntity> {
    const lang = await this.findOneLang(id);
    this.langRepository.merge(lang, updateLangDto);
    return this.langRepository.save(lang);
  }

  async deleteLang(id: number): Promise<void> {
    const lang = await this.findOneLang(id);
    await this.langRepository.remove(lang);
  }

  // Translation CRUD
  async createTranslation(createTranslationDto: CreateTranslationDto): Promise<TranslationEntity> {
    const { langId, ...rest } = createTranslationDto;
    const lang = await this.findOneLang(langId);

    const translation = this.translationRepository.create({
      ...rest,
      lang,
    });
    return this.translationRepository.save(translation);
  }

  async findAllTranslations(filters?: {
    section?: string;
    langId?: number;
    entityName?: string;
    entityId?: string;
  }): Promise<TranslationEntity[]> {
    const where: any = {};
    if (filters?.section) where.section = filters.section;
    if (filters?.langId) where.lang = { id: filters.langId };
    if (filters?.entityName) where.entityName = filters.entityName;
    if (filters?.entityId) where.entityId = filters.entityId;

    return this.translationRepository.find({
      where,
      relations: ['lang'],
    });
  }

  async findOneTranslation(id: number): Promise<TranslationEntity> {
    const translation = await this.translationRepository.findOne({ where: { id }, relations: ['lang'] });
    if (!translation) {
      throw new NotFoundException(`Translation with ID ${id} not found`);
    }
    return translation;
  }

  async updateTranslation(id: number, updateTranslationDto: UpdateTranslationDto): Promise<TranslationEntity> {
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

    for (const lang of langs) {
      const translations = await this.translationRepository.find({
        where: {
          lang: { id: lang.id },
          entityName: IsNull(),
          entityId: IsNull(),
        },
      });

      const result = {};

      for (const t of translations) {
        const fullPath = t.section ? `${t.section}.${t.key}` : t.key;
        this.setDeepValue(result, fullPath, t.content);
      }

      const jsonContent = JSON.stringify(result, null, 2);

      const cwd = process.cwd();
      let backPath = '';
      let frontPath = '';

      if (cwd.endsWith('apps/back')) {
        backPath = path.join(cwd, 'src/i18n');
        frontPath = path.join(cwd, '../front/locales');
      } else {
        backPath = path.join(cwd, 'apps/back/src/i18n');
        frontPath = path.join(cwd, 'apps/front/locales');
      }

      await fs.mkdir(backPath, { recursive: true });
      await fs.mkdir(frontPath, { recursive: true });

      const fileName = `${lang.code}.json`;
      await fs.writeFile(path.join(backPath, fileName), jsonContent);
      await fs.writeFile(path.join(frontPath, fileName), jsonContent);
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
  async getTranslationsForEntity(entityName: string, entityId: string, langCode: string): Promise<Record<string, string>> {
    const lang = await this.langRepository.findOne({ where: { code: langCode } });
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
