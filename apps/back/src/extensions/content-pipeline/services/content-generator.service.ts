import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { ContentPipelineIdeaEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/idea.entity';

export interface SocialVariant {
  platform: string;
  mediaType: 'image' | 'video' | 'text' | 'carousel';
  caption: string;
  hashtags: string[];
  mediaPrompt: string;
}

export interface GenerationResult {
  blogContent: string;
  socialVariants: SocialVariant[];
  generationLog: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    generationTimeMs: number;
  };
}

interface ChatChoice {
  message?: { content?: string };
}
interface ChatResponse {
  choices?: ChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Generates blog content + social variants for a draft by calling the
 * Ollama Cloud OpenAI-compatible /chat/completions endpoint.
 */
@Injectable()
export class ContentGeneratorService {
  private readonly logger = new Logger(ContentGeneratorService.name);
  private readonly cfg: ContentPipelineConfig | null;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.cfg = this.configService.get('content-pipeline', { infer: true }) ?? null;
  }

  get isConfigured(): boolean {
    return !!this.cfg?.ollamaApiKey && !!this.cfg?.ollamaBaseUrl;
  }

  async generate(
    project: ContentPipelineProjectEntity,
    idea: ContentPipelineIdeaEntity,
  ): Promise<GenerationResult> {
    const startedAt = Date.now();
    if (!this.isConfigured) {
      this.logger.warn('Ollama API key/baseUrl not configured — skipping generation');
      return {
        blogContent: '',
        socialVariants: [],
        generationLog: {
          model: this.cfg?.ollamaModel ?? 'unknown',
          generationTimeMs: 0,
        },
      };
    }

    const model = this.cfg!.ollamaModel;
    const baseUrl = this.cfg!.ollamaBaseUrl;
    const timeoutMs = this.cfg!.ollamaTimeoutMs ?? 60_000;

    const systemPrompt = this.buildSystemPrompt(project, idea.contentType);
    const userPrompt = this.buildUserPrompt(project, idea);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: ChatResponse | null = null;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg!.ollamaApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `Ollama API error: ${res.status} ${res.statusText} — ${text.slice(0, 500)}`,
        );
        return this.emptyResult(model, startedAt);
      }

      response = (await res.json()) as ChatResponse;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        this.logger.error(`Ollama request timed out after ${timeoutMs}ms`);
      } else {
        this.logger.error(`Ollama request failed: ${(err as Error)?.message ?? err}`);
      }
      return this.emptyResult(model, startedAt);
    } finally {
      clearTimeout(timer);
    }

    const raw = response?.choices?.[0]?.message?.content ?? '';
    const parsed = this.parseResponse(raw);

    return {
      blogContent: parsed.blogContent,
      socialVariants: parsed.socialVariants,
      generationLog: {
        model,
        promptTokens: response?.usage?.prompt_tokens,
        completionTokens: response?.usage?.completion_tokens,
        generationTimeMs: Date.now() - startedAt,
      },
    };
  }

  private emptyResult(model: string, startedAt: number): GenerationResult {
    return {
      blogContent: '',
      socialVariants: [],
      generationLog: { model, generationTimeMs: Date.now() - startedAt },
    };
  }

  private buildSystemPrompt(
    project: ContentPipelineProjectEntity,
    contentType: string,
  ): string {
    const voice = project.brandVoice ?? 'friendly, authoritative, practical';
    const audience = project.targetAudience ?? 'general audience';
    const lang = project.language === 'es' ? 'Spanish (Spain)' : 'English';

    const typeInstructions: Record<string, string> = {
      recipe:
        'Write a complete recipe: intro, ingredients list, step-by-step instructions, tips, and a closing note.',
      comparison:
        'Write a comparison post: intro, side-by-side comparison table, pros/cons per option, verdict.',
      review:
        'Write a review: intro, detailed analysis, pros, cons, rating, and recommendation.',
      listicle:
        'Write a listicle: intro + numbered items (5-10), each with a heading and 2-3 paragraphs.',
      guide:
        'Write a how-to guide: intro, prerequisites, numbered steps, troubleshooting, conclusion.',
      tips:
        'Write a tips post: intro + 5-8 actionable tips, each with a heading and explanation.',
    };

    return [
      `You are a professional content writer for the "${project.niche}" niche.`,
      `Brand voice: ${voice}.`,
      `Target audience: ${audience}.`,
      `Language: ${lang}.`,
      `Content type: ${contentType}.`,
      typeInstructions[contentType] ?? typeInstructions.tips,
      '',
      'Output format — STRICT JSON, no markdown fences, no prose outside JSON:',
      '{',
      '  "blogContent": "# Title\\n\\nFull markdown blog post...",',
      '  "socialVariants": [',
      '    { "platform": "instagram", "mediaType": "image", "caption": "...", "hashtags": ["#tag1"], "mediaPrompt": "visual description for image generation" }',
      '  ]',
      '}',
      'Generate one socialVariant per target platform from the idea.',
      'blogContent must be Markdown. Include H2/H3 headings.',
    ].join('\n');
  }

  private buildUserPrompt(
    project: ContentPipelineProjectEntity,
    idea: ContentPipelineIdeaEntity,
  ): string {
    return [
      `Title: ${idea.title}`,
      `Angle: ${idea.angle ?? ''}`,
      `Keywords: ${idea.keywords.join(', ')}`,
      `Target platforms: ${idea.targetPlatforms.join(', ')}`,
      `Project keywords: ${project.keywords.join(', ')}`,
      '',
      'Generate the blog post and one social variant per target platform.',
    ].join('\n');
  }

  private parseResponse(raw: string): {
    blogContent: string;
    socialVariants: SocialVariant[];
  } {
    if (!raw) return { blogContent: '', socialVariants: [] };

    // Try JSON extraction first
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0]);
        if (obj.blogContent) {
          return {
            blogContent: String(obj.blogContent),
            socialVariants: Array.isArray(obj.socialVariants)
              ? obj.socialVariants.map(this.normalizeVariant.bind(this)).filter(Boolean)
              : [],
          };
        }
      } catch {
        this.logger.warn('LLM returned malformed JSON — falling back to raw content');
      }
    }

    // Fallback: treat entire raw text as blog content
    return { blogContent: raw, socialVariants: [] };
  }

  private normalizeVariant(v: any): SocialVariant | null {
    if (!v || typeof v !== 'object') return null;
    return {
      platform: String(v.platform ?? 'instagram'),
      mediaType: (v.mediaType as SocialVariant['mediaType']) ?? 'image',
      caption: String(v.caption ?? ''),
      hashtags: Array.isArray(v.hashtags) ? v.hashtags.map(String) : [],
      mediaPrompt: String(v.mediaPrompt ?? ''),
    };
  }
}