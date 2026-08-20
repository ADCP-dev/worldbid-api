/**
 * EmbedService — generates text embeddings via configurable providers.
 *
 * Supports:
 *   - openai: POST https://api.openai.com/v1/embeddings
 *   - ollama: POST <OLLAMA_URL>/api/embeddings (default http://localhost:11434)
 *   - local:  pseudo-embedding stub for tests / offline dev
 *
 * Provider is selected by explicit argument > EMBED_PROVIDER config > 'openai'.
 *
 * PRD 06: pgvector Integration
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbedProvider {
  embed(text: string, model: string): Promise<number[]>;
}

@Injectable()
export class EmbedService implements EmbedProvider {
  private readonly logger = new Logger('EmbedService');

  constructor(private readonly configService: ConfigService) {}

  async embed(text: string, model: string, provider?: string): Promise<number[]> {
    const resolvedProvider =
      provider || this.configService.get<string>('EMBED_PROVIDER') || 'openai';

    switch (resolvedProvider) {
      case 'openai':
        return this.embedOpenAI(text, model);
      case 'ollama':
        return this.embedOllama(text, model);
      case 'local':
        return this.embedLocal(text, model);
      default:
        throw new Error(`Unknown embed provider: ${resolvedProvider}`);
    }
  }

  private async embedOpenAI(text: string, model: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI embeddings API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  private async embedOllama(text: string, model: string): Promise<number[]> {
    const ollamaUrl =
      this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434';

    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, model }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embeddings API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  private async embedLocal(text: string, _model: string): Promise<number[]> {
    // Stub: deterministic pseudo-embedding for tests / offline development.
    // DO NOT use in production — this is not a real semantic embedding.
    this.logger.warn(
      'local embed provider is a stub — use openai or ollama in production',
    );
    const hash = Array.from(text).reduce(
      (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
      0,
    );
    return Array.from({ length: 1536 }, (_, i) => (hash + i * 7) % 1000 / 1000);
  }
}