import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { LangEntity } from '../entities/lang.entity';
import { TranslationEntity } from '../entities/translation.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TranslationSeedService {
  constructor(
    @InjectRepository(LangEntity)
    private readonly langRepository: Repository<LangEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
  ) {}

  async run() {
    const isDist = __dirname.includes('dist');
    const backI18nPath = isDist
      ? path.resolve(__dirname, '../../../../../src/i18n')
      : path.resolve(__dirname, '../../../../i18n');

    const frontLocalesPath = isDist
      ? path.resolve(__dirname, '../../../../../../../front/locales')
      : path.resolve(__dirname, '../../../../../../front/locales');

    await this.processDirectory(backI18nPath, 'back');
    await this.processDirectory(frontLocalesPath, 'front');
  }

  private async processDirectory(basePath: string, appContext: string) {
    try {
      const langDirs = await fs.readdir(basePath);

      for (const langCode of langDirs) {
        const langPath = path.join(basePath, langCode);
        const stat = await fs.stat(langPath);

        if (stat.isDirectory()) {
          const files = await fs.readdir(langPath);
          const jsonFiles = files.filter((f) => f.endsWith('.json'));

          for (const file of jsonFiles) {
            const sectionName = path.basename(file, '.json');
            await this.seedLangFile(
              langCode,
              sectionName,
              path.join(langPath, file),
              appContext,
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        `Could not find or read directory ${basePath}:`,
        error.message,
      );
    }
  }

  private async seedLangFile(
    langCode: string,
    sectionName: string,
    filePath: string,
    appContext: string,
  ) {
    let lang = await this.langRepository.findOne({ where: { code: langCode } });
    if (!lang) {
      lang = this.langRepository.create({
        code: langCode,
        name: langCode.toUpperCase(), // Default name
        isActive: true,
      });
      lang = await this.langRepository.save(lang);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    const flattened = this.flattenObject(json);

    // Fetch existing keys for this lang and app
    const existingTranslations = await this.translationRepository.find({
      where: {
        lang: { id: lang.id },
        app: appContext,
        entityName: IsNull(),
        entityId: IsNull(),
      },
      select: ['section', 'key'],
    });

    const existingSet = new Set(
      existingTranslations.map((t) => `${t.section}.${t.key}`),
    );

    const toInsert: Partial<TranslationEntity>[] = [];

    for (const [flatKey, value] of Object.entries(flattened)) {
      // Combines the filename (sectionName) with the nested flat path
      const fullKey = `${sectionName}.${flatKey}`;

      if (!existingSet.has(fullKey)) {
        const lastDotIndex = fullKey.lastIndexOf('.');
        let section = 'common';
        let key = fullKey;

        if (lastDotIndex !== -1) {
          section = fullKey.substring(0, lastDotIndex);
          key = fullKey.substring(lastDotIndex + 1);
        }

        toInsert.push({
          lang,
          app: appContext,
          section,
          key,
          content: String(value),
        });
      }
    }

    if (toInsert.length > 0) {
      // Chunk insert to avoid parameters limit
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        await this.translationRepository.save(toInsert.slice(i, i + chunkSize));
      }
      console.log(
        `Seeded ${toInsert.length} new translations for ${langCode} (${appContext})`,
      );
    } else {
      console.log(
        `No new translations for ${langCode} (${appContext} - ${sectionName})`,
      );
    }
  }

  private flattenObject(obj: any, prefix = '') {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        Object.assign(acc, this.flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  }
}
