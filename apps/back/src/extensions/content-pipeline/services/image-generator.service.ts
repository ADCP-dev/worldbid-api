import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

export interface GeneratedImage {
  url: string;
  type: 'hero' | 'content';
  alt: string;
  width: number;
  height: number;
}

interface WaveSpeedResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  images?: string[];
  error?: string;
}

/**
 * Generates hero + content images for a draft via WaveSpeed AI.
 * Returns an empty array gracefully if no API key is configured.
 */
@Injectable()
export class ImageGeneratorService {
  private readonly logger = new Logger(ImageGeneratorService.name);
  private readonly cfg: ContentPipelineConfig | null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.cfg =
      this.configService.get('content-pipeline', { infer: true }) ?? null;
  }

  get isConfigured(): boolean {
    return !!this.cfg?.wavespeedApiKey;
  }

  /**
   * Generate a hero (landscape 1024x576) + a content (square 1024x1024)
   * image for a draft. Returns [] if not configured.
   */
  async generateImages(params: {
    title: string;
    mediaPrompt?: string;
    niche?: string;
  }): Promise<GeneratedImage[]> {
    if (!this.isConfigured) {
      this.logger.warn(
        'WaveSpeed API key not configured — returning empty images',
      );
      return [];
    }

    const apiKey = this.cfg!.wavespeedApiKey!;
    const baseUrl = this.cfg!.wavespeedBaseUrl ?? 'https://api.wavespeed.ai';
    const model = this.cfg!.wavespeedDefaultModel ?? 'flux-2-klein';

    const basePrompt = params.mediaPrompt?.trim()
      ? params.mediaPrompt
      : `${params.niche ?? ''} ${params.title}`.trim();

    const heroPrompt = `${basePrompt}, professional hero banner, landscape, high quality, cinematic lighting`;
    const contentPrompt = `${basePrompt}, square composition, detailed, vibrant, high quality`;

    const jobs: Array<Promise<GeneratedImage | null>> = [
      this.generateOne(baseUrl, apiKey, model, heroPrompt, '1024x576', 'hero'),
      this.generateOne(
        baseUrl,
        apiKey,
        model,
        contentPrompt,
        '1024x1024',
        'content',
      ),
    ];

    const results = await Promise.allSettled(jobs);
    const images: GeneratedImage[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) images.push(r.value);
    }

    this.logger.log(
      `Generated ${images.length}/2 images for "${params.title}"`,
    );
    return images;
  }

  private async generateOne(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    size: string,
    type: 'hero' | 'content',
  ): Promise<GeneratedImage | null> {
    const [widthStr, heightStr] = size.split('x');
    const width = Number(widthStr);
    const height = Number(heightStr);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(`${baseUrl}/api/v3/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `WaveSpeed ${type} image error: ${res.status} — ${text.slice(0, 300)}`,
        );
        return null;
      }

      const data = (await res.json()) as WaveSpeedResponse;
      const url = data.data?.[0]?.url ?? data.images?.[0];
      if (!url) {
        this.logger.warn(`WaveSpeed ${type} returned no image URL`);
        return null;
      }

      return {
        url,
        type,
        alt:
          type === 'hero'
            ? `Hero image for ${prompt.slice(0, 60)}`
            : `Content image`,
        width,
        height,
      };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        this.logger.error(`WaveSpeed ${type} request timed out`);
      } else {
        this.logger.error(
          `WaveSpeed ${type} failed: ${(err as Error)?.message ?? err}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
