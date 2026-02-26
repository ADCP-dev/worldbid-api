import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { LangEntity } from './infrastructure/entities/lang.entity';
import { TranslationEntity } from './infrastructure/entities/translation.entity';

@Injectable()
export class TranslationAgentService {
  private readonly BATCH_SIZE = 15;
  private readonly logger = new Logger(TranslationAgentService.name);

  constructor(
    @InjectRepository(LangEntity)
    private readonly langRepository: Repository<LangEntity>,
    @InjectRepository(TranslationEntity)
    private readonly translationRepository: Repository<TranslationEntity>,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  private getLlm() {
    const openrouterApiKey = this.configService.get<string>(
      'app.openRouterApiKey',
      { infer: true },
    );

    const translationModel = this.configService.get<string>(
      'app.translationModel',
      { infer: true },
    );

    return new ChatOpenAI({
      model: translationModel || 'openrouter/free',
      temperature: 0.1,
      apiKey: openrouterApiKey || 'missing-key',
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Foundation',
        },
      },
    });
  }

  private async directTranslate(
    combos: Array<{ app: string; section: string; key: string }>,
  ) {
    const llm = this.getLlm().bindTools([this.createCheckTranslateTool()]);

    // Convert to explicit readable text format for prompt
    const input = `You are a translation expert.
Use the 'check_and_batch_translate' tool ONLY ONCE with the identical combinations I provide below.
Wait for the response of the tool before responding any text.

Combos: ${JSON.stringify(combos)}`;

    const result = await llm.invoke(input);

    // Execute tool manually if chosen
    for (const toolCall of result.tool_calls || []) {
      if (toolCall.name === 'check_and_batch_translate') {
        const args = toolCall.args as any;
        return await this.createCheckTranslateTool().invoke(args);
      }
    }

    return result.content || 'Translations checked successfully.';
  }

  async translateRow(
    app: string,
    section: string,
    key: string,
  ): Promise<string> {
    try {
      const output = await this.directTranslate([{ app, section, key }]);
      return typeof output === 'string' ? output : JSON.stringify(output);
    } catch (error) {
      this.logger.error('translateRow failed', error);
      return `Error: ${(error as Error).message}`;
    }
  }

  async bulkTranslateAll(app: string = 'front'): Promise<string> {
    try {
      const allLangsCount = await this.langRepository.count({
        where: { isActive: true },
      });

      const missingCombos = await this.translationRepository
        .createQueryBuilder('t')
        .select(['t.app', 't.section', 't.key'])
        .where('t.app = :app', { app })
        .andWhere('t.entityName IS NULL')
        .andWhere('t.entityId IS NULL')
        .groupBy('t.app, t.section, t.key')
        .having('COUNT(t.id) < :count', { count: allLangsCount })
        .limit(this.BATCH_SIZE)
        .getRawMany();

      if (!missingCombos.length) {
        return 'No missing translations.';
      }

      const combos = missingCombos.map((c) => ({
        app: c.t_app || c.app,
        section: c.t_section || c.section,
        key: c.t_key || c.key,
      }));

      const output = await this.directTranslate(combos);
      return typeof output === 'string' ? output : JSON.stringify(output);
    } catch (error) {
      this.logger.error('bulkTranslateAll failed', error);
      return `Error: ${(error as Error).message}`;
    }
  }

  private createCheckTranslateTool() {
    const llm = this.getLlm();
    return tool(
      async ({
        combos,
      }: {
        combos: Array<{ app: string; section: string; key: string }>;
      }) => {
        try {
          const langs = await this.langRepository.find({
            where: { isActive: true },
          });
          const sourceLang = langs.find((l) => l.code === 'es') || langs[0];
          if (!sourceLang) return '❌ No source language (es).';

          // Efficient: Single query for all relevant translations
          const allRelevant = await this.translationRepository.find({
            where: combos.flatMap((combo) =>
              langs.map((lang) => ({
                entityName: IsNull(),
                entityId: IsNull(),
                app: combo.app,
                section: combo.section,
                key: combo.key,
                lang: { id: lang.id },
              })),
            ),
            relations: ['lang'],
          });

          const existing = new Map(
            allRelevant.map((t) => [
              `${t.app}:${t.section}:${t.key}:${t.lang.id}`,
              t,
            ]),
          );

          const missing: Array<{
            app: string;
            section: string;
            key: string;
            langId: number;
            source?: string;
          }> = [];

          for (const combo of combos) {
            const sourceRow = allRelevant.find(
              (t) =>
                t.app === combo.app &&
                t.section === combo.section &&
                t.key === combo.key &&
                t.lang.id === sourceLang.id,
            );
            if (!sourceRow) continue;

            for (const lang of langs) {
              const key = `${combo.app}:${combo.section}:${combo.key}:${lang.id}`;
              if (!existing.has(key)) {
                missing.push({
                  app: combo.app,
                  section: combo.section,
                  key: combo.key,
                  langId: lang.id,
                  source: sourceRow.content,
                });
              }
            }
          }

          if (!missing.length) return `No missing for ${combos.length} combos.`;

          // 1 LLM call: Batch translate
          const targetCodes = langs
            .filter((l) => l.id !== sourceLang.id)
            .map((l) => l.code)
            .join(', ');
          const texts = missing.map((m, i) => `${i}: "${m.source}"`).join('\n');
          const prompt = `You are a professional software translator.
Translate from ${sourceLang.code} to ${targetCodes}.
IMPORTANT RULES:
1. Maintain technical acronyms correctly (e.g., in English "IA" must be translated as "AI").
2. Content is for a software application interface; keep it concise and professional.
3. Keep placeholders like {name}, {count}, %s, etc., exactly as they are.
4. Return ONLY a valid JSON object following this exact structure: { "0": {"en": "...", "fr": "..."}, "1": {...} }

Texts to translate:
${texts}`;

          const response = await llm.invoke(prompt);
          const jsonStr = response.content
            .toString()
            .replace(/```json|```/g, '')
            .trim();
          const translations = JSON.parse(jsonStr) as Record<
            string,
            Record<string, string>
          >;

          // Batch insert
          const now = new Date();
          const insertData: Partial<TranslationEntity>[] = missing
            .map((m, idx) => {
              const lang = langs.find((l) => l.id === m.langId);
              const translated =
                translations[idx.toString()]?.[lang?.code || ''];
              if (!translated) return null;

              return {
                app: m.app,
                section: m.section,
                key: m.key,
                content: translated,
                lang: lang,
                entityName: null,
                entityId: null,
                createdAt: now,
                updatedAt: now,
              };
            })
            .filter((i) => i !== null) as any[];

          const saved = await this.translationRepository.save(
            insertData.map((data) => this.translationRepository.create(data)),
          );
          return `Created ${saved.length} translations from ${missing.length} missing.`;
        } catch (error) {
          this.logger.error('Tool failed', error);
          return `❌ Tool error: ${(error as Error).message}`;
        }
      },
      {
        name: 'check_and_batch_translate',
        description:
          'Efficiently batch-check/translate missing langs for app+section+key combos.',
        schema: {
          type: 'object',
          properties: {
            combos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  app: { type: 'string' },
                  section: { type: 'string' },
                  key: { type: 'string' },
                },
                required: ['app', 'section', 'key'],
              },
            },
          },
          required: ['combos'],
        } as any,
      },
    );
  }
}
