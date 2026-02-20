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
    const cwd = process.cwd();
    let i18nPath = '';

    // Adjust path based on where the process is running (root vs apps/back)
    if (cwd.endsWith('apps/back')) {
      i18nPath = path.join(cwd, 'src/i18n');
    } else {
      i18nPath = path.join(cwd, 'apps/back/src/i18n');
    }

    try {
      const files = await fs.readdir(i18nPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const langCode = path.basename(file, '.json');
        await this.seedLang(langCode, path.join(i18nPath, file));
      }
    } catch (error) {
      console.warn('Could not find i18n directory or read files:', error.message);
    }
  }

  private async seedLang(langCode: string, filePath: string) {
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

    // Fetch existing keys for this lang (static only)
    const existingTranslations = await this.translationRepository.find({
      where: {
        lang: { id: lang.id },
        entityName: IsNull(),
        entityId: IsNull(),
      },
      select: ['section', 'key'],
    });

    const existingSet = new Set(
      existingTranslations.map(t => `${t.section}.${t.key}`)
    );

    const toInsert: Partial<TranslationEntity>[] = [];

    for (const [fullKey, value] of Object.entries(flattened)) {
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
      console.log(`Seeded ${toInsert.length} new translations for ${langCode}`);
    } else {
        console.log(`No new translations for ${langCode}`);
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
