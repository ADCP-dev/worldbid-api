import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

export const CONTENT_PIPELINE_PROVIDER = 'CONTENT_PIPELINE_CONFIG';

/**
 * Provider that resolves the content-pipeline config.
 * Returns null if the LLM API key is not configured — the extension will be inert
 * (entities still load, controllers return 503, crons no-op).
 */
export const contentPipelineProvider = {
  provide: CONTENT_PIPELINE_PROVIDER,
  useFactory: (
    configService: ConfigService<AllConfigType>,
  ): ContentPipelineConfig | null => {
    const cfg = configService.get('content-pipeline', { infer: true });
    if (!cfg?.llmApiKey) {
      new Logger('ContentPipelineProvider').warn(
        'OLLAMA_API_KEY not configured — content generation will be inert',
      );
    }
    return cfg ?? null;
  },
  inject: [ConfigService],
};
