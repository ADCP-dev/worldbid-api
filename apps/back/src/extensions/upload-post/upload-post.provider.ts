import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { UploadPostConfig } from '@ext/upload-post/config/upload-post-config.type';

export const UPLOAD_POST_PROVIDER = 'UPLOAD_POST_CLIENT';

/**
 * Provider that validates the Upload-Post API key and returns the config.
 * The actual HTTP client lives in UploadPostClientService — this provider
 * only ensures the config is resolved at DI time and available for injection.
 */
export const uploadPostProvider = {
  provide: UPLOAD_POST_PROVIDER,
  useFactory: (
    configService: ConfigService<AllConfigType>,
  ): UploadPostConfig | null => {
    const cfg = configService.get('upload-post', { infer: true });

    if (!cfg?.apiKey) {
      const logger = new Logger('UploadPostProvider');
      logger.warn(
        'UPLOAD_POST_API_KEY not configured — extension will be inert',
      );
      return null;
    }

    return cfg;
  },
  inject: [ConfigService],
};
