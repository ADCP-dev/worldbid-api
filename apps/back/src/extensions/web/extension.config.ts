import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import { WebConfig } from './web-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  REVALIDATE_SECRET: string;

  @IsString()
  @IsOptional()
  ASTRO_URL: string;
}

export default registerAs<WebConfig>('web', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    revalidateSecret: process.env.REVALIDATE_SECRET,
    astroUrl: process.env.ASTRO_URL,
  };
});