import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import type { AllConfigType } from '@src/config/config.type';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

/**
 * Loads a DESIGN.md (or brand document) from disk and caches its content.
 * The document is injected into LLM prompts after the main instructions,
 * so all generated content follows the brand's visual and tonal guidelines.
 *
 * The file is read once and cached. If the file changes, call `reload()`.
 * If no path is configured, returns empty string (no injection).
 */
@Injectable()
export class DesignSystemLoaderService {
  private readonly logger = new Logger(DesignSystemLoaderService.name);
  private readonly cfg: ContentPipelineConfig | null;
  private cachedContent: string | null = null;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.cfg = this.configService.get('content-pipeline', { infer: true }) ?? null;
  }

  /** Returns the design doc content, or empty string if not configured. */
  async getDesignDoc(): Promise<string> {
    if (!this.cfg?.designDocPath) return '';

    if (this.cachedContent !== null) return this.cachedContent;

    try {
      const content = await readFile(this.cfg.designDocPath, 'utf8');
      this.cachedContent = content;
      this.logger.log(`Loaded design doc from ${this.cfg.designDocPath} (${content.length} chars)`);
      return content;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to load design doc from ${this.cfg.designDocPath}: ${err instanceof Error ? err.message : String(err)} — injection will be empty`,
      );
      this.cachedContent = '';
      return '';
    }
  }

  /** Force re-read the file on next access (clears cache). */
  reload(): void {
    this.cachedContent = null;
    this.logger.log('Design doc cache cleared — will re-read on next access');
  }

  /** True if a design doc path is configured and the file was loaded successfully. */
  get isConfigured(): boolean {
    return !!this.cfg?.designDocPath && this.cachedContent !== '' && this.cachedContent !== null;
  }
}