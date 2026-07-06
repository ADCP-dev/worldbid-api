import { registerAs } from '@nestjs/config';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import {
  UploadPostConfig,
  DEFAULT_WEEKLY_REPORT_CRON,
  UPLOAD_POST_API_BASE,
} from '@ext/upload-post/config/upload-post-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  UPLOAD_POST_API_KEY: string;

  @IsString()
  @IsOptional()
  UPLOAD_POST_PROFILE_USERNAME: string;

  @IsString()
  @IsOptional()
  UPLOAD_POST_WEBHOOK_SECRET: string;

  @IsString()
  @IsOptional()
  UPLOAD_POST_WEEKLY_REPORT_CRON: string;

  @IsString()
  @IsOptional()
  UPLOAD_POST_WEEKLY_REPORT_EMAIL: string;
}

export default registerAs<UploadPostConfig>('upload-post', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    apiKey: process.env.UPLOAD_POST_API_KEY,
    apiUrl: UPLOAD_POST_API_BASE,
    webhookSecret: process.env.UPLOAD_POST_WEBHOOK_SECRET,
    profileUsername: process.env.UPLOAD_POST_PROFILE_USERNAME,
    weeklyReportCron:
      process.env.UPLOAD_POST_WEEKLY_REPORT_CRON ?? DEFAULT_WEEKLY_REPORT_CRON,
    weeklyReportEmail: process.env.UPLOAD_POST_WEEKLY_REPORT_EMAIL,
  };
});
