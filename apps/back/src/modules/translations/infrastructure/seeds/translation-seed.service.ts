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
          // Recursively collect all JSON files with their relative subfolder path
          const jsonFiles = await this.collectJsonFiles(langPath, '');

          for (const { filePath, folderPrefix } of jsonFiles) {
            const sectionName = path.basename(filePath, '.json');
            await this.seedLangFile(
              langCode,
              sectionName,
              filePath,
              appContext,
              folderPrefix,
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

  /**
   * Recursively collect all .json files under a lang directory.
   * Returns each file's absolute path and its relative folder prefix
   * (relative to the lang root, using '.' as separator).
   * e.g. base/auth.json → { filePath: '.../base/auth.json', folderPrefix: 'base' }
   * e.g. landing.json   → { filePath: '.../landing.json',   folderPrefix: '' }
   */
  private async collectJsonFiles(
    dir: string,
    relativePrefix: string,
  ): Promise<{ filePath: string; folderPrefix: string }[]> {
    const results: { filePath: string; folderPrefix: string }[] = [];
    const entries = await fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const subPrefix = relativePrefix
          ? `${relativePrefix}.${entry}`
          : entry;
        const sub = await this.collectJsonFiles(fullPath, subPrefix);
        results.push(...sub);
      } else if (entry.endsWith('.json')) {
        results.push({ filePath: fullPath, folderPrefix: relativePrefix });
      }
    }

    return results;
  }

  private async seedLangFile(
    langCode: string,
    sectionName: string,
    filePath: string,
    appContext: string,
    folderPrefix: string,
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

    // The section prefix encodes the folder path with ':' separator:
    // - no subfolder  → sectionName          (e.g. "landing")
    // - with subfolder → "folderPrefix:sectionName" (e.g. "base:auth")
    const sectionFilePrefix = folderPrefix
      ? `${folderPrefix}:${sectionName}`
      : sectionName;

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
      // Combines the sectionFilePrefix with the nested flat path
      // e.g. "base:auth" + "loginPage.description" → "base:auth.loginPage.description"
      const fullKey = `${sectionFilePrefix}.${flatKey}`;

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
        `Seeded ${toInsert.length} new translations for ${langCode} (${appContext} - ${sectionFilePrefix})`,
      );
    } else {
      console.log(
        `No new translations for ${langCode} (${appContext} - ${sectionFilePrefix})`,
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
